import "server-only";

import type { Redis } from "@upstash/redis";
import { z } from "zod";

import { COOLDOWN_MS, MAX_TURN_ITEMS } from "../config/game";
import { TEAMS, getTeamById } from "../config/teams";
import { interactionSchema, teamStateSchema } from "../domain/schemas";
import type {
  AdjudicationResult,
  Interaction,
  InteractionItem,
  TeamState,
} from "../domain/types";
import { redisKey, runRedisOperation } from "./redis";

export type StoredInteraction = Interaction & {
  /** 0 before adjudication, 1 after the single allowed AI call is claimed. */
  aiAttempts: number;
  /** Lease timestamp used only to fail an abandoned call, never to retry it. */
  aiStartedAt: number | null;
};

export type InteractionCreation = {
  interaction: StoredInteraction;
  duplicate: boolean;
};

export type InteractionCreationResult =
  | { kind: "CREATED"; value: InteractionCreation }
  | { kind: "EXISTING"; value: InteractionCreation }
  | { kind: "COOLDOWN"; cooldownUntil: number }
  | { kind: "CASE_SOLVED"; caseId: string };

export type EventExport = {
  exportedAt: number;
  teams: TeamState[];
  interactions: StoredInteraction[];
  caseEnabledOverrides: Record<string, boolean>;
  aiCallCount: number;
};

export interface EventStore {
  getTeamState(teamId: string): Promise<TeamState>;
  getAllTeamStates(): Promise<TeamState[]>;
  getInteraction(interactionId: string): Promise<StoredInteraction | null>;
  getTeamInteractions(teamId: string): Promise<StoredInteraction[]>;
  getAllInteractions(): Promise<StoredInteraction[]>;
  createInteraction(input: {
    id: string;
    gmId: string;
    teamId: string;
    items: InteractionItem[];
    now?: number;
  }): Promise<InteractionCreationResult>;
  beginAiAttempt(interactionId: string, now?: number): Promise<number | null>;
  failStaleAiAttempt(
    interactionId: string,
    staleBefore: number,
  ): Promise<StoredInteraction | null>;
  saveAiSuccess(
    interactionId: string,
    results: AdjudicationResult[],
    model: string,
  ): Promise<StoredInteraction | null>;
  saveAiError(
    interactionId: string,
    safeError: string,
    model?: string | null,
  ): Promise<StoredInteraction | null>;
  reserveAiCall(maxCalls: number): Promise<number | null>;
  getAiCallCount(): Promise<number>;
  finalizeInteraction(
    interactionId: string,
    results: AdjudicationResult[],
    options?: { allowUpdate?: boolean; now?: number },
  ): Promise<StoredInteraction | null>;
  resetCooldown(teamId: string): Promise<TeamState>;
  setQuestionCount(teamId: string, questionCount: number): Promise<TeamState>;
  markSolved(
    teamId: string,
    caseId: string,
    solvedAt?: number,
  ): Promise<TeamState>;
  unmarkSolved(teamId: string, caseId: string): Promise<TeamState>;
  setCaseEnabled(caseId: string, enabled: boolean): Promise<void>;
  getCaseEnabledOverrides(): Promise<Record<string, boolean>>;
  exportState(): Promise<EventExport>;
  resetGame(): Promise<void>;
}

type RedisOperationRunner = <T>(
  operation: (redis: Redis) => Promise<T>,
) => Promise<T>;

const storedInteractionSchema = interactionSchema
  .extend({
    aiAttempts: z.number().int().min(0).max(1),
    aiStartedAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

function defaultTeamState(teamId: string): TeamState {
  if (!getTeamById(teamId)) {
    throw new Error("Unknown team");
  }
  return {
    teamId,
    questionCount: 0,
    turnItemsUsed: 0,
    cooldownUntil: null,
    solvedCases: [],
    lastInteractionAt: null,
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value) as unknown;
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function restoreMissingNulls(
  value: Record<string, unknown>,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (!(field in value)) value[field] = null;
  }
}

function normalizeStoredResults(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const result of value) {
    if (!isPlainRecord(result)) continue;
    if (result.itemType === "QUESTION" && !("finalCorrect" in result)) {
      result.finalCorrect = null;
    }
    if (result.itemType === "FINAL_ANSWER" && !("verdict" in result)) {
      result.verdict = null;
    }
  }
}

function parseTeamState(value: unknown, expectedTeamId: string): TeamState {
  const decoded = parseJson(value);
  // Redis Lua's cjson represents an empty Lua table as `{}`. An empty JSON
  // solvedCases array can therefore round-trip as a plain empty object.
  if (
    isPlainRecord(decoded) &&
    "solvedCases" in decoded
  ) {
    const solvedCases = decoded.solvedCases;
    if (
      solvedCases &&
      typeof solvedCases === "object" &&
      !Array.isArray(solvedCases) &&
      Object.keys(solvedCases).length === 0
    ) {
      decoded.solvedCases = [];
    }
  }
  if (isPlainRecord(decoded)) {
    // Upstash's Lua cjson omits object properties whose value is JSON null.
    restoreMissingNulls(decoded, ["cooldownUntil", "lastInteractionAt"]);
  }
  const state = teamStateSchema.parse(decoded);
  if (state.teamId !== expectedTeamId) {
    throw new Error("Redis returned state for a different team.");
  }
  return state;
}

function parseInteraction(value: unknown): StoredInteraction {
  const decoded = parseJson(value);
  if (isPlainRecord(decoded)) {
    restoreMissingNulls(decoded, [
      "finalizedAt",
      "aiResults",
      "finalResults",
      "aiError",
      "model",
      "aiStartedAt",
    ]);
    normalizeStoredResults(decoded.aiResults);
    normalizeStoredResults(decoded.finalResults);
  }
  return storedInteractionSchema.parse(decoded);
}

function parseOptionalInteraction(value: unknown): StoredInteraction | null {
  return value === null || value === undefined
    ? null
    : parseInteraction(value);
}

function sortInteractions(
  interactions: readonly StoredInteraction[],
): StoredInteraction[] {
  return [...interactions].sort(
    (left, right) =>
      right.submittedAt - left.submittedAt || left.id.localeCompare(right.id),
  );
}

function interactionKey(interactionId: string): string {
  return redisKey("interaction", interactionId);
}

function interactionKeyPrefix(): string {
  return redisKey("interaction");
}

function teamKey(teamId: string): string {
  return redisKey("team", teamId);
}

function teamInteractionsKey(teamId: string): string {
  return redisKey("team-interactions", teamId);
}

function allInteractionsKey(): string {
  return redisKey("interactions");
}

function aiCallCountKey(): string {
  return redisKey("ai-call-count");
}

function caseOverridesKey(): string {
  return redisKey("case-enabled-overrides");
}

const GET_TEAM_SCRIPT = String.raw`
-- blackgame:get-team:v1
local raw = redis.call("GET", KEYS[1])
local state = cjson.decode(raw or ARGV[2])
local changed = not raw
local cooldown_until = state.cooldownUntil
if cooldown_until ~= nil and cooldown_until ~= cjson.null and tonumber(cooldown_until) <= tonumber(ARGV[1]) then
  state.cooldownUntil = cjson.null
  state.turnItemsUsed = 0
  changed = true
end
local encoded = cjson.encode(state)
if changed then redis.call("SET", KEYS[1], encoded) end
return encoded
`;

const GET_ALL_TEAMS_SCRIPT = String.raw`
-- blackgame:get-all-teams:v1
local now = tonumber(ARGV[1])
local result = {}
for index, key in ipairs(KEYS) do
  local raw = redis.call("GET", key)
  local state = cjson.decode(raw or ARGV[index + 1])
  local changed = not raw
  local cooldown_until = state.cooldownUntil
  if cooldown_until ~= nil and cooldown_until ~= cjson.null and tonumber(cooldown_until) <= now then
    state.cooldownUntil = cjson.null
    state.turnItemsUsed = 0
    changed = true
  end
  local encoded = cjson.encode(state)
  if changed then redis.call("SET", key, encoded) end
  result[index] = encoded
end
return result
`;

const GET_INTERACTION_SCRIPT = String.raw`
-- blackgame:get-interaction:v1
return redis.call("GET", KEYS[1])
`;

const GET_INDEXED_INTERACTIONS_SCRIPT = String.raw`
-- blackgame:get-indexed-interactions:v1
local ids = redis.call("SMEMBERS", KEYS[1])
local result = {}
for _, id in ipairs(ids) do
  local raw = redis.call("GET", ARGV[1] .. ":" .. id)
  if raw then table.insert(result, raw) end
end
return result
`;

const CREATE_INTERACTION_SCRIPT = String.raw`
-- blackgame:create-interaction:v1
local team_raw = redis.call("GET", KEYS[2])
local team = cjson.decode(team_raw or ARGV[1])
local now = tonumber(ARGV[2])
local changed = not team_raw
local cooldown_until = team.cooldownUntil
if cooldown_until ~= nil and cooldown_until ~= cjson.null and tonumber(cooldown_until) <= now then
  team.cooldownUntil = cjson.null
  team.turnItemsUsed = 0
  changed = true
end
if changed then redis.call("SET", KEYS[2], cjson.encode(team)) end

local existing = redis.call("GET", KEYS[1])
if existing then return { "EXISTING", existing } end

cooldown_until = team.cooldownUntil
if cooldown_until ~= nil and cooldown_until ~= cjson.null and tonumber(cooldown_until) > now then
  return { "COOLDOWN", tostring(cooldown_until) }
end

local submitted_cases = cjson.decode(ARGV[8])
for _, solved in ipairs(team.solvedCases or {}) do
  if submitted_cases[solved.caseId] then
    return { "CASE_SOLVED", solved.caseId }
  end
end

local maximum = tonumber(ARGV[3])
local used = math.min(maximum, tonumber(team.turnItemsUsed or 0) + 1)
team.questionCount = tonumber(team.questionCount or 0) + tonumber(ARGV[6])
team.turnItemsUsed = used
if used >= maximum then
  team.cooldownUntil = now + tonumber(ARGV[4])
else
  team.cooldownUntil = cjson.null
end
team.lastInteractionAt = now

redis.call("SET", KEYS[1], ARGV[5])
redis.call("SET", KEYS[2], cjson.encode(team))
redis.call("SADD", KEYS[3], ARGV[7])
redis.call("SADD", KEYS[4], ARGV[7])
return { "CREATED", ARGV[5] }
`;

const BEGIN_AI_ATTEMPT_SCRIPT = String.raw`
-- blackgame:begin-ai-attempt:v1
local raw = redis.call("GET", KEYS[1])
if not raw then return false end
local interaction = cjson.decode(raw)
if interaction.status == "FINALIZED" or tonumber(interaction.aiAttempts or 0) >= 1 then
  return false
end
interaction.aiAttempts = 1
interaction.aiStartedAt = tonumber(ARGV[1])
redis.call("SET", KEYS[1], cjson.encode(interaction))
return 1
`;

const FAIL_STALE_AI_SCRIPT = String.raw`
-- blackgame:fail-stale-ai:v1
local raw = redis.call("GET", KEYS[1])
if not raw then return false end
local interaction = cjson.decode(raw)
local started_at = interaction.aiStartedAt
if started_at == nil or started_at == cjson.null then started_at = interaction.submittedAt end
if interaction.status == "FINALIZED"
  or tonumber(interaction.aiAttempts or 0) < 1
  or (interaction.aiResults ~= nil and interaction.aiResults ~= cjson.null)
  or (interaction.aiError ~= nil and interaction.aiError ~= cjson.null)
  or tonumber(started_at) > tonumber(ARGV[1]) then
  return false
end
interaction.aiError = "AI_STALE: Tiến trình chấm đã kết thúc trước khi lưu được kết quả."
local encoded = cjson.encode(interaction)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const SAVE_AI_SUCCESS_SCRIPT = String.raw`
-- blackgame:save-ai-success:v1
local raw = redis.call("GET", KEYS[1])
if not raw then return false end
local interaction = cjson.decode(raw)
interaction.aiResults = cjson.decode(ARGV[1])
interaction.aiError = cjson.null
interaction.model = ARGV[2]
if interaction.status ~= "FINALIZED" then interaction.status = "AI_COMPLETE" end
local encoded = cjson.encode(interaction)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const SAVE_AI_ERROR_SCRIPT = String.raw`
-- blackgame:save-ai-error:v1
local raw = redis.call("GET", KEYS[1])
if not raw then return false end
local interaction = cjson.decode(raw)
interaction.aiResults = cjson.null
interaction.aiError = ARGV[1]
if ARGV[2] == "1" then interaction.model = ARGV[3] end
local encoded = cjson.encode(interaction)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const RESERVE_AI_CALL_SCRIPT = String.raw`
-- blackgame:reserve-ai-call:v1
local maximum = tonumber(ARGV[1])
local count = tonumber(redis.call("GET", KEYS[1]) or "0") or 0
if count >= maximum then return -1 end
count = count + 1
redis.call("SET", KEYS[1], tostring(count))
return count
`;

const GET_AI_CALL_COUNT_SCRIPT = String.raw`
-- blackgame:get-ai-call-count:v1
return tonumber(redis.call("GET", KEYS[1]) or "0") or 0
`;

const FINALIZE_INTERACTION_SCRIPT = String.raw`
-- blackgame:finalize-interaction:v1
local raw = redis.call("GET", KEYS[1])
if not raw then return false end
local interaction = cjson.decode(raw)
local allow_update = ARGV[1] == "1"
if interaction.status == "FINALIZED" and not allow_update then return raw end

local team_raw = redis.call("GET", KEYS[2])
local team = cjson.decode(team_raw or ARGV[2])
local results = cjson.decode(ARGV[3])
local by_item = {}
for _, item in ipairs(interaction.items or {}) do by_item[item.id] = item end

local earliest = {}
local function retain(candidate)
  local current = earliest[candidate.caseId]
  if not current
    or tonumber(candidate.solvedAt) < tonumber(current.solvedAt)
    or (tonumber(candidate.solvedAt) == tonumber(current.solvedAt) and candidate.interactionId < current.interactionId) then
    earliest[candidate.caseId] = candidate
  end
end

for _, solved in ipairs(team.solvedCases or {}) do
  if not allow_update or solved.interactionId ~= interaction.id then retain(solved) end
end
for _, result in ipairs(results) do
  local item = by_item[result.itemId]
  if item
    and item.type == "FINAL_ANSWER"
    and result.itemType == "FINAL_ANSWER"
    and result.finalCorrect == true then
    retain({ caseId = item.caseId, solvedAt = interaction.submittedAt, interactionId = interaction.id })
  end
end

local solved_cases = {}
for _, solved in pairs(earliest) do table.insert(solved_cases, solved) end
table.sort(solved_cases, function(left, right) return left.caseId < right.caseId end)
team.solvedCases = solved_cases
interaction.finalResults = results
interaction.finalizedAt = tonumber(ARGV[4])
interaction.status = "FINALIZED"

local interaction_encoded = cjson.encode(interaction)
redis.call("SET", KEYS[1], interaction_encoded)
redis.call("SET", KEYS[2], cjson.encode(team))
return interaction_encoded
`;

const RESET_COOLDOWN_SCRIPT = String.raw`
-- blackgame:reset-cooldown:v1
local state = cjson.decode(redis.call("GET", KEYS[1]) or ARGV[1])
state.cooldownUntil = cjson.null
state.turnItemsUsed = 0
local encoded = cjson.encode(state)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const SET_QUESTION_COUNT_SCRIPT = String.raw`
-- blackgame:set-question-count:v1
local state = cjson.decode(redis.call("GET", KEYS[1]) or ARGV[1])
state.questionCount = tonumber(ARGV[2])
local encoded = cjson.encode(state)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const MARK_SOLVED_SCRIPT = String.raw`
-- blackgame:mark-solved:v1
local state = cjson.decode(redis.call("GET", KEYS[1]) or ARGV[1])
for _, solved in ipairs(state.solvedCases or {}) do
  if solved.caseId == ARGV[2] then return cjson.encode(state) end
end
table.insert(state.solvedCases, {
  caseId = ARGV[2],
  solvedAt = tonumber(ARGV[3]),
  interactionId = ARGV[4]
})
local encoded = cjson.encode(state)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const UNMARK_SOLVED_SCRIPT = String.raw`
-- blackgame:unmark-solved:v1
local state = cjson.decode(redis.call("GET", KEYS[1]) or ARGV[1])
local retained = {}
for _, solved in ipairs(state.solvedCases or {}) do
  if solved.caseId ~= ARGV[2] then table.insert(retained, solved) end
end
state.solvedCases = retained
local encoded = cjson.encode(state)
redis.call("SET", KEYS[1], encoded)
return encoded
`;

const SET_CASE_ENABLED_SCRIPT = String.raw`
-- blackgame:set-case-enabled:v1
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return 1
`;

const GET_CASE_OVERRIDES_SCRIPT = String.raw`
-- blackgame:get-case-overrides:v1
return redis.call("HGETALL", KEYS[1])
`;

const RESET_GAME_SCRIPT = String.raw`
-- blackgame:reset-game:v1
local ids = redis.call("SMEMBERS", KEYS[1])
for _, id in ipairs(ids) do redis.call("DEL", ARGV[1] .. ":" .. id) end
redis.call("DEL", unpack(KEYS))
return #ids
`;

/**
 * Redis-backed shared state. Every multi-key state transition is one Lua
 * script, so quota, cooldown, idempotency and solve ranking remain atomic even
 * when Vercel invokes several function instances concurrently.
 */
export class RedisEventStore implements EventStore {
  constructor(private readonly run: RedisOperationRunner = runRedisOperation) {}

  async getTeamState(teamId: string): Promise<TeamState> {
    const fallback = defaultTeamState(teamId);
    return this.run(async (redis) => {
      const raw = await redis.eval(
        GET_TEAM_SCRIPT,
        [teamKey(teamId)],
        [String(Date.now()), JSON.stringify(fallback)],
      );
      return parseTeamState(raw, teamId);
    });
  }

  async getAllTeamStates(): Promise<TeamState[]> {
    const defaults = TEAMS.map((team) => defaultTeamState(team.id));
    return this.run(async (redis) => {
      const raw = await redis.eval(
        GET_ALL_TEAMS_SCRIPT,
        TEAMS.map((team) => teamKey(team.id)),
        [String(Date.now()), ...defaults.map((state) => JSON.stringify(state))],
      );
      if (!Array.isArray(raw) || raw.length !== TEAMS.length) {
        throw new Error("Redis returned an invalid team-state collection.");
      }
      return raw.map((value, index) =>
        parseTeamState(value, TEAMS[index]!.id),
      );
    });
  }

  async getInteraction(
    interactionId: string,
  ): Promise<StoredInteraction | null> {
    return this.run(async (redis) => {
      const raw = await redis.eval(
        GET_INTERACTION_SCRIPT,
        [interactionKey(interactionId)],
        [],
      );
      return parseOptionalInteraction(raw);
    });
  }

  async getTeamInteractions(teamId: string): Promise<StoredInteraction[]> {
    defaultTeamState(teamId);
    return this.getIndexedInteractions(teamInteractionsKey(teamId));
  }

  async getAllInteractions(): Promise<StoredInteraction[]> {
    return this.getIndexedInteractions(allInteractionsKey());
  }

  private async getIndexedInteractions(indexKey: string) {
    return this.run(async (redis) => {
      const raw = await redis.eval(
        GET_INDEXED_INTERACTIONS_SCRIPT,
        [indexKey],
        [interactionKeyPrefix()],
      );
      if (!Array.isArray(raw)) {
        throw new Error("Redis returned an invalid interaction collection.");
      }
      return sortInteractions(raw.map(parseInteraction));
    });
  }

  async createInteraction(input: {
    id: string;
    gmId: string;
    teamId: string;
    items: InteractionItem[];
    now?: number;
  }): Promise<InteractionCreationResult> {
    const fallback = defaultTeamState(input.teamId);
    const now = input.now ?? Date.now();
    const interaction: StoredInteraction = {
      id: input.id,
      gmId: input.gmId,
      teamId: input.teamId,
      submittedAt: now,
      finalizedAt: null,
      status: "PENDING",
      items: input.items.map((item) => ({ ...item })),
      aiResults: null,
      finalResults: null,
      aiError: null,
      model: null,
      aiAttempts: 0,
      aiStartedAt: null,
    };
    const questionIncrement = input.items.reduce(
      (total, item) => total + (item.type === "QUESTION" ? 1 : 0),
      0,
    );
    const submittedCases = Object.fromEntries(
      input.items.map((item) => [item.caseId, true]),
    );

    return this.run(async (redis) => {
      const raw = await redis.eval(
        CREATE_INTERACTION_SCRIPT,
        [
          interactionKey(input.id),
          teamKey(input.teamId),
          teamInteractionsKey(input.teamId),
          allInteractionsKey(),
        ],
        [
          JSON.stringify(fallback),
          String(now),
          String(MAX_TURN_ITEMS),
          String(COOLDOWN_MS),
          JSON.stringify(interaction),
          String(questionIncrement),
          input.id,
          JSON.stringify(submittedCases),
        ],
      );
      if (!Array.isArray(raw) || typeof raw[0] !== "string") {
        throw new Error("Redis returned an invalid interaction transition.");
      }
      if (raw[0] === "CREATED" || raw[0] === "EXISTING") {
        const stored = parseInteraction(raw[1]);
        return {
          kind: raw[0],
          value: {
            interaction: stored,
            duplicate: raw[0] === "EXISTING",
          },
        };
      }
      if (raw[0] === "COOLDOWN") {
        const cooldownUntil = Number(raw[1]);
        if (!Number.isFinite(cooldownUntil)) {
          throw new Error("Redis returned an invalid cooldown timestamp.");
        }
        return { kind: "COOLDOWN", cooldownUntil };
      }
      if (raw[0] === "CASE_SOLVED" && typeof raw[1] === "string") {
        return { kind: "CASE_SOLVED", caseId: raw[1] };
      }
      throw new Error("Redis returned an unknown interaction transition.");
    });
  }

  async beginAiAttempt(
    interactionId: string,
    now = Date.now(),
  ): Promise<number | null> {
    return this.run(async (redis) => {
      const result = await redis.eval(
        BEGIN_AI_ATTEMPT_SCRIPT,
        [interactionKey(interactionId)],
        [String(now)],
      );
      return Number(result) === 1 ? 1 : null;
    });
  }

  async failStaleAiAttempt(
    interactionId: string,
    staleBefore: number,
  ): Promise<StoredInteraction | null> {
    return this.run(async (redis) => {
      const raw = await redis.eval(
        FAIL_STALE_AI_SCRIPT,
        [interactionKey(interactionId)],
        [String(staleBefore)],
      );
      return parseOptionalInteraction(raw);
    });
  }

  async saveAiSuccess(
    interactionId: string,
    results: AdjudicationResult[],
    model: string,
  ): Promise<StoredInteraction | null> {
    return this.run(async (redis) => {
      const raw = await redis.eval(
        SAVE_AI_SUCCESS_SCRIPT,
        [interactionKey(interactionId)],
        [JSON.stringify(results), model],
      );
      return parseOptionalInteraction(raw);
    });
  }

  async saveAiError(
    interactionId: string,
    safeError: string,
    model: string | null = null,
  ): Promise<StoredInteraction | null> {
    return this.run(async (redis) => {
      const raw = await redis.eval(
        SAVE_AI_ERROR_SCRIPT,
        [interactionKey(interactionId)],
        [safeError.slice(0, 300), model === null ? "0" : "1", model ?? ""],
      );
      return parseOptionalInteraction(raw);
    });
  }

  async reserveAiCall(maxCalls: number): Promise<number | null> {
    const maximum = Number.isFinite(maxCalls)
      ? Math.max(0, Math.trunc(maxCalls))
      : 0;
    return this.run(async (redis) => {
      const raw = await redis.eval(
        RESERVE_AI_CALL_SCRIPT,
        [aiCallCountKey()],
        [String(maximum)],
      );
      const reserved = Number(raw);
      return reserved >= 1 ? reserved : null;
    });
  }

  async getAiCallCount(): Promise<number> {
    return this.run(async (redis) => {
      const raw = await redis.eval(GET_AI_CALL_COUNT_SCRIPT, [aiCallCountKey()], []);
      const count = Number(raw);
      if (!Number.isFinite(count) || count < 0) {
        throw new Error("Redis returned an invalid AI call count.");
      }
      return Math.trunc(count);
    });
  }

  async finalizeInteraction(
    interactionId: string,
    results: AdjudicationResult[],
    options: { allowUpdate?: boolean; now?: number } = {},
  ): Promise<StoredInteraction | null> {
    const existing = await this.getInteraction(interactionId);
    if (!existing) {
      return null;
    }
    const fallback = defaultTeamState(existing.teamId);
    return this.run(async (redis) => {
      const raw = await redis.eval(
        FINALIZE_INTERACTION_SCRIPT,
        [interactionKey(interactionId), teamKey(existing.teamId)],
        [
          options.allowUpdate ? "1" : "0",
          JSON.stringify(fallback),
          JSON.stringify(results),
          String(options.now ?? Date.now()),
        ],
      );
      return parseOptionalInteraction(raw);
    });
  }

  async resetCooldown(teamId: string): Promise<TeamState> {
    const fallback = defaultTeamState(teamId);
    return this.run(async (redis) => {
      const raw = await redis.eval(
        RESET_COOLDOWN_SCRIPT,
        [teamKey(teamId)],
        [JSON.stringify(fallback)],
      );
      return parseTeamState(raw, teamId);
    });
  }

  async setQuestionCount(
    teamId: string,
    questionCount: number,
  ): Promise<TeamState> {
    const fallback = defaultTeamState(teamId);
    const normalized = Number.isFinite(questionCount)
      ? Math.max(0, Math.trunc(questionCount))
      : 0;
    return this.run(async (redis) => {
      const raw = await redis.eval(
        SET_QUESTION_COUNT_SCRIPT,
        [teamKey(teamId)],
        [JSON.stringify(fallback), String(normalized)],
      );
      return parseTeamState(raw, teamId);
    });
  }

  async markSolved(
    teamId: string,
    caseId: string,
    solvedAt = Date.now(),
  ): Promise<TeamState> {
    const fallback = defaultTeamState(teamId);
    return this.run(async (redis) => {
      const raw = await redis.eval(
        MARK_SOLVED_SCRIPT,
        [teamKey(teamId)],
        [
          JSON.stringify(fallback),
          caseId,
          String(solvedAt),
          `admin-${solvedAt}`,
        ],
      );
      return parseTeamState(raw, teamId);
    });
  }

  async unmarkSolved(teamId: string, caseId: string): Promise<TeamState> {
    const fallback = defaultTeamState(teamId);
    return this.run(async (redis) => {
      const raw = await redis.eval(
        UNMARK_SOLVED_SCRIPT,
        [teamKey(teamId)],
        [JSON.stringify(fallback), caseId],
      );
      return parseTeamState(raw, teamId);
    });
  }

  async setCaseEnabled(caseId: string, enabled: boolean): Promise<void> {
    await this.run(async (redis) => {
      await redis.eval(
        SET_CASE_ENABLED_SCRIPT,
        [caseOverridesKey()],
        [caseId, enabled ? "1" : "0"],
      );
    });
  }

  async getCaseEnabledOverrides(): Promise<Record<string, boolean>> {
    return this.run(async (redis) => {
      const raw = await redis.eval(
        GET_CASE_OVERRIDES_SCRIPT,
        [caseOverridesKey()],
        [],
      );
      if (!Array.isArray(raw) || raw.length % 2 !== 0) {
        throw new Error("Redis returned invalid case overrides.");
      }
      const overrides: Record<string, boolean> = {};
      for (let index = 0; index < raw.length; index += 2) {
        const caseId = raw[index];
        const value = raw[index + 1];
        if (typeof caseId !== "string" || (value !== "0" && value !== "1")) {
          throw new Error("Redis returned invalid case override data.");
        }
        overrides[caseId] = value === "1";
      }
      return overrides;
    });
  }

  async exportState(): Promise<EventExport> {
    const [teams, interactions, caseEnabledOverrides, aiCallCount] =
      await Promise.all([
        this.getAllTeamStates(),
        this.getAllInteractions(),
        this.getCaseEnabledOverrides(),
        this.getAiCallCount(),
      ]);
    return {
      exportedAt: Date.now(),
      teams,
      interactions,
      caseEnabledOverrides,
      aiCallCount,
    };
  }

  async resetGame(): Promise<void> {
    await this.run(async (redis) => {
      await redis.eval(
        RESET_GAME_SCRIPT,
        [
          allInteractionsKey(),
          aiCallCountKey(),
          caseOverridesKey(),
          ...TEAMS.map((team) => teamKey(team.id)),
          ...TEAMS.map((team) => teamInteractionsKey(team.id)),
        ],
        [interactionKeyPrefix()],
      );
    });
  }
}

const globalStore = globalThis as typeof globalThis & {
  __blackgameRedisEventStore?: RedisEventStore;
};

export function getEventStore(): EventStore {
  globalStore.__blackgameRedisEventStore ??= new RedisEventStore();
  return globalStore.__blackgameRedisEventStore;
}

export function resetEventStoreForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Chỉ được reset event store trong môi trường test.");
  }
  delete globalStore.__blackgameRedisEventStore;
}
