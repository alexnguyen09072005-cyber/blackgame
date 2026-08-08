import type { Redis } from "@upstash/redis";
import { afterEach, describe, expect, it } from "vitest";

import { COOLDOWN_MS } from "../../lib/config/game";
import type {
  AdjudicationResult,
  InteractionItem,
  SolvedCase,
  TeamState,
} from "../../lib/domain/types";
import {
  getEventStore,
  RedisEventStore,
  resetEventStoreForTests,
  type StoredInteraction,
} from "../../lib/server/store";

function id(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function question(itemId: string, caseId = "case-01"): InteractionItem {
  return {
    id: itemId,
    caseId,
    type: "QUESTION",
    content: "Có phải do trời mưa không?",
  };
}

function finalAnswer(itemId: string, caseId = "case-01"): InteractionItem {
  return {
    id: itemId,
    caseId,
    type: "FINAL_ANSWER",
    content: "Đây là lời giải cuối cùng.",
  };
}

function correctResult(itemId: string): AdjudicationResult {
  return {
    itemId,
    itemType: "FINAL_ANSWER",
    verdict: null,
    finalCorrect: true,
    confidence: "HIGH",
    gmNote: "Đúng",
  };
}

function chooseEarliest(candidates: SolvedCase[]): SolvedCase[] {
  const earliest = new Map<string, SolvedCase>();
  for (const candidate of candidates) {
    const current = earliest.get(candidate.caseId);
    if (
      !current ||
      candidate.solvedAt < current.solvedAt ||
      (candidate.solvedAt === current.solvedAt &&
        candidate.interactionId < current.interactionId)
    ) {
      earliest.set(candidate.caseId, { ...candidate });
    }
  }
  return [...earliest.values()].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );
}

/** Small stateful EVAL harness; production transition logic remains in Lua. */
class FakeRedis {
  readonly strings = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  readonly hashes = new Map<string, Map<string, string>>();

  private encodeTeam(state: TeamState): string {
    const value: Omit<TeamState, "solvedCases"> & {
      solvedCases: SolvedCase[] | Record<string, never>;
    } = structuredClone(state);
    // Match Redis Lua cjson's empty-table behavior for the regression test.
    if (value.solvedCases.length === 0) value.solvedCases = {};
    return JSON.stringify(value);
  }

  private parseTeam(raw: string): TeamState {
    const parsed = JSON.parse(raw) as TeamState & {
      solvedCases: SolvedCase[] | Record<string, never>;
    };
    if (!Array.isArray(parsed.solvedCases)) parsed.solvedCases = [];
    return parsed as TeamState;
  }

  private interaction(key: string): StoredInteraction | null {
    const raw = this.strings.get(key);
    return raw ? (JSON.parse(raw) as StoredInteraction) : null;
  }

  async eval(
    script: string,
    keys: string[],
    args: string[],
  ): Promise<unknown> {
    if (script.includes("blackgame:get-all-teams:v1")) {
      return keys.map((key, index) => {
        const raw = this.strings.get(key);
        const state = this.parseTeam(raw ?? args[index + 1]!);
        if (
          state.cooldownUntil !== null &&
          state.cooldownUntil <= Number(args[0])
        ) {
          state.cooldownUntil = null;
          state.turnItemsUsed = 0;
        }
        const encoded = this.encodeTeam(state);
        this.strings.set(key, encoded);
        return encoded;
      });
    }

    if (script.includes("blackgame:get-team:v1")) {
      const state = this.parseTeam(this.strings.get(keys[0]!) ?? args[1]!);
      if (
        state.cooldownUntil !== null &&
        state.cooldownUntil <= Number(args[0])
      ) {
        state.cooldownUntil = null;
        state.turnItemsUsed = 0;
      }
      const encoded = this.encodeTeam(state);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:get-interaction:v1")) {
      return this.strings.get(keys[0]!) ?? null;
    }

    if (script.includes("blackgame:get-indexed-interactions:v1")) {
      return [...(this.sets.get(keys[0]!) ?? [])]
        .map((interactionId) =>
          this.strings.get(`${args[0]}:${interactionId}`),
        )
        .filter((value): value is string => Boolean(value));
    }

    if (script.includes("blackgame:create-interaction:v1")) {
      const team = this.parseTeam(this.strings.get(keys[1]!) ?? args[0]!);
      const now = Number(args[1]);
      if (team.cooldownUntil !== null && team.cooldownUntil <= now) {
        team.cooldownUntil = null;
        team.turnItemsUsed = 0;
      }
      this.strings.set(keys[1]!, this.encodeTeam(team));

      const existing = this.strings.get(keys[0]!);
      if (existing) return ["EXISTING", existing];
      if (team.cooldownUntil !== null && team.cooldownUntil > now) {
        return ["COOLDOWN", String(team.cooldownUntil)];
      }
      const submittedCases = JSON.parse(args[7]!) as Record<string, boolean>;
      const solved = team.solvedCases.find(
        (candidate) => submittedCases[candidate.caseId],
      );
      if (solved) return ["CASE_SOLVED", solved.caseId];

      const maximum = Number(args[2]);
      team.questionCount += Number(args[5]);
      team.turnItemsUsed = Math.min(maximum, team.turnItemsUsed + 1);
      team.cooldownUntil =
        team.turnItemsUsed >= maximum ? now + Number(args[3]) : null;
      team.lastInteractionAt = now;
      this.strings.set(keys[0]!, args[4]!);
      this.strings.set(keys[1]!, this.encodeTeam(team));
      for (const key of [keys[2]!, keys[3]!]) {
        const index = this.sets.get(key) ?? new Set<string>();
        index.add(args[6]!);
        this.sets.set(key, index);
      }
      return ["CREATED", args[4]!];
    }

    if (script.includes("blackgame:begin-ai-attempt:v1")) {
      const interaction = this.interaction(keys[0]!);
      if (
        !interaction ||
        interaction.status === "FINALIZED" ||
        interaction.aiAttempts >= 1
      ) {
        return null;
      }
      interaction.aiAttempts = 1;
      interaction.aiStartedAt = Number(args[0]);
      this.strings.set(keys[0]!, JSON.stringify(interaction));
      return 1;
    }

    if (script.includes("blackgame:fail-stale-ai:v1")) {
      const interaction = this.interaction(keys[0]!);
      if (
        !interaction ||
        interaction.status === "FINALIZED" ||
        interaction.aiAttempts < 1 ||
        interaction.aiResults ||
        interaction.aiError ||
        (interaction.aiStartedAt ?? interaction.submittedAt) > Number(args[0])
      ) {
        return null;
      }
      interaction.aiError =
        "AI_STALE: Tiến trình chấm đã kết thúc trước khi lưu được kết quả.";
      const encoded = JSON.stringify(interaction);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:save-ai-success:v1")) {
      const interaction = this.interaction(keys[0]!);
      if (!interaction) return null;
      interaction.aiResults = JSON.parse(args[0]!) as AdjudicationResult[];
      interaction.aiError = null;
      interaction.model = args[1]!;
      if (interaction.status !== "FINALIZED") interaction.status = "AI_COMPLETE";
      const encoded = JSON.stringify(interaction);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:save-ai-error:v1")) {
      const interaction = this.interaction(keys[0]!);
      if (!interaction) return null;
      interaction.aiResults = null;
      interaction.aiError = args[0]!;
      if (args[1] === "1") interaction.model = args[2]!;
      const encoded = JSON.stringify(interaction);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:reserve-ai-call:v1")) {
      const current = Number(this.strings.get(keys[0]!) ?? "0");
      if (current >= Number(args[0])) return -1;
      this.strings.set(keys[0]!, String(current + 1));
      return current + 1;
    }

    if (script.includes("blackgame:get-ai-call-count:v1")) {
      return Number(this.strings.get(keys[0]!) ?? "0");
    }

    if (script.includes("blackgame:finalize-interaction:v1")) {
      const interaction = this.interaction(keys[0]!);
      if (!interaction) return null;
      const allowUpdate = args[0] === "1";
      if (interaction.status === "FINALIZED" && !allowUpdate) {
        return JSON.stringify(interaction);
      }
      const team = this.parseTeam(this.strings.get(keys[1]!) ?? args[1]!);
      const results = JSON.parse(args[2]!) as AdjudicationResult[];
      const items = new Map(interaction.items.map((item) => [item.id, item]));
      const retained = allowUpdate
        ? team.solvedCases.filter(
            (solved) => solved.interactionId !== interaction.id,
          )
        : team.solvedCases;
      const candidates = results.flatMap((result): SolvedCase[] => {
        const item = items.get(result.itemId);
        return item?.type === "FINAL_ANSWER" &&
          result.itemType === "FINAL_ANSWER" &&
          result.finalCorrect === true
          ? [
              {
                caseId: item.caseId,
                solvedAt: interaction.submittedAt,
                interactionId: interaction.id,
              },
            ]
          : [];
      });
      team.solvedCases = chooseEarliest([...retained, ...candidates]);
      interaction.finalResults = results;
      interaction.finalizedAt = Number(args[3]);
      interaction.status = "FINALIZED";
      const encoded = JSON.stringify(interaction);
      this.strings.set(keys[0]!, encoded);
      this.strings.set(keys[1]!, this.encodeTeam(team));
      return encoded;
    }

    if (script.includes("blackgame:reset-cooldown:v1")) {
      const team = this.parseTeam(this.strings.get(keys[0]!) ?? args[0]!);
      team.cooldownUntil = null;
      team.turnItemsUsed = 0;
      const encoded = this.encodeTeam(team);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:set-question-count:v1")) {
      const team = this.parseTeam(this.strings.get(keys[0]!) ?? args[0]!);
      team.questionCount = Number(args[1]);
      const encoded = this.encodeTeam(team);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:mark-solved:v1")) {
      const team = this.parseTeam(this.strings.get(keys[0]!) ?? args[0]!);
      if (!team.solvedCases.some((solved) => solved.caseId === args[1])) {
        team.solvedCases.push({
          caseId: args[1]!,
          solvedAt: Number(args[2]),
          interactionId: args[3]!,
        });
      }
      const encoded = this.encodeTeam(team);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:unmark-solved:v1")) {
      const team = this.parseTeam(this.strings.get(keys[0]!) ?? args[0]!);
      team.solvedCases = team.solvedCases.filter(
        (solved) => solved.caseId !== args[1],
      );
      const encoded = this.encodeTeam(team);
      this.strings.set(keys[0]!, encoded);
      return encoded;
    }

    if (script.includes("blackgame:set-case-enabled:v1")) {
      const hash = this.hashes.get(keys[0]!) ?? new Map<string, string>();
      hash.set(args[0]!, args[1]!);
      this.hashes.set(keys[0]!, hash);
      return 1;
    }

    if (script.includes("blackgame:get-case-overrides:v1")) {
      return [...(this.hashes.get(keys[0]!) ?? new Map()).entries()].flat();
    }

    if (script.includes("blackgame:reset-game:v1")) {
      for (const interactionId of this.sets.get(keys[0]!) ?? []) {
        this.strings.delete(`${args[0]}:${interactionId}`);
      }
      for (const key of keys) {
        this.strings.delete(key);
        this.sets.delete(key);
        this.hashes.delete(key);
      }
      return 1;
    }

    throw new Error(`Unsupported script: ${script.slice(0, 80)}`);
  }
}

function createStore(): RedisEventStore {
  const fake = new FakeRedis();
  return new RedisEventStore(async <T>(operation: (redis: Redis) => Promise<T>) =>
    operation(fake as unknown as Redis),
  );
}

afterEach(() => {
  resetEventStoreForTests();
});

describe("RedisEventStore", () => {
  it("khởi tạo đủ 12 OG và normalize solvedCases rỗng từ Lua cjson", async () => {
    const store = createStore();
    const states = await store.getAllTeamStates();

    expect(states).toHaveLength(12);
    expect(states.map((state) => state.teamId)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `og-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    await expect(store.getTeamState("og-01")).resolves.toMatchObject({
      questionCount: 0,
      turnItemsUsed: 0,
      solvedCases: [],
    });
  });

  it("atomically giữ idempotency và chỉ nhận slot thứ 5", async () => {
    const store = createStore();
    const now = Date.now() + 60_000;

    for (let index = 1; index <= 4; index += 1) {
      await expect(
        store.createInteraction({
          id: id(index),
          gmId: "player:og01",
          teamId: "og-01",
          items: [question(`q-${index}`)],
          now: now + index,
        }),
      ).resolves.toMatchObject({ kind: "CREATED" });
    }

    const fifthAt = now + 10;
    const [fifth, later] = await Promise.all([
      store.createInteraction({
        id: id(5),
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-5")],
        now: fifthAt,
      }),
      store.createInteraction({
        id: id(6),
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-6")],
        now: fifthAt,
      }),
    ]);
    expect(fifth).toMatchObject({ kind: "CREATED" });
    expect(later).toEqual({
      kind: "COOLDOWN",
      cooldownUntil: fifthAt + COOLDOWN_MS,
    });

    await expect(
      store.createInteraction({
        id: id(5),
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-5")],
        now: fifthAt + 1,
      }),
    ).resolves.toMatchObject({ kind: "EXISTING" });
    await expect(store.getAllInteractions()).resolves.toHaveLength(5);

    await expect(
      store.createInteraction({
        id: id(7),
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-after")],
        now: fifthAt + COOLDOWN_MS,
      }),
    ).resolves.toMatchObject({ kind: "CREATED" });
    await expect(store.getTeamState("og-01")).resolves.toMatchObject({
      turnItemsUsed: 1,
      cooldownUntil: null,
    });
  });

  it("chỉ cấp một AI attempt, giữ outcome và cap toàn cục", async () => {
    const store = createStore();
    const interactionId = id(20);
    const item = finalAnswer("f-ai");
    await store.createInteraction({
      id: interactionId,
      gmId: "player:og01",
      teamId: "og-01",
      items: [item],
      now: 1_000,
    });

    await expect(store.beginAiAttempt(interactionId, 2_000)).resolves.toBe(1);
    await expect(store.beginAiAttempt(interactionId, 2_001)).resolves.toBeNull();
    const stale = await store.failStaleAiAttempt(interactionId, 2_000);
    expect(stale?.aiError).toContain("AI_STALE");

    const result = correctResult(item.id);
    await expect(
      store.saveAiSuccess(interactionId, [result], "test-model"),
    ).resolves.toMatchObject({
      status: "AI_COMPLETE",
      aiResults: [result],
      aiError: null,
    });
    await expect(
      Promise.all([
        store.reserveAiCall(2),
        store.reserveAiCall(2),
        store.reserveAiCall(2),
      ]),
    ).resolves.toEqual([1, 2, null]);
    await expect(store.getAiCallCount()).resolves.toBe(2);
  });

  it("finalize giữ submittedAt sớm nhất và chặn update ngoài ý muốn", async () => {
    const store = createStore();
    const earlyId = id(30);
    const lateId = id(31);
    const earlyItem = finalAnswer("f-early", "case-09");
    const lateItem = finalAnswer("f-late", "case-09");

    await store.createInteraction({
      id: earlyId,
      gmId: "player:og01",
      teamId: "og-01",
      items: [earlyItem],
      now: 1_000,
    });
    await store.createInteraction({
      id: lateId,
      gmId: "player:og01",
      teamId: "og-01",
      items: [lateItem],
      now: 2_000,
    });
    await store.finalizeInteraction(lateId, [correctResult(lateItem.id)], {
      now: 3_000,
    });
    await store.finalizeInteraction(earlyId, [correctResult(earlyItem.id)], {
      now: 4_000,
    });

    expect((await store.getTeamState("og-01")).solvedCases).toEqual([
      { caseId: "case-09", solvedAt: 1_000, interactionId: earlyId },
    ]);
    const unchanged = await store.finalizeInteraction(
      earlyId,
      [{ ...correctResult(earlyItem.id), finalCorrect: false }],
      { now: 5_000 },
    );
    expect(unchanged?.finalizedAt).toBe(4_000);
    expect(unchanged?.finalResults?.[0]?.finalCorrect).toBe(true);
  });

  it("giữ các thao tác admin/index/export/reset và unmark phần tử cuối", async () => {
    const store = createStore();
    await store.setQuestionCount("og-12", 7);
    await store.markSolved("og-12", "case-01", 10);
    await expect(store.unmarkSolved("og-12", "case-01")).resolves.toMatchObject({
      solvedCases: [],
    });
    await store.setCaseEnabled("case-09", false);
    await expect(store.getCaseEnabledOverrides()).resolves.toEqual({
      "case-09": false,
    });
    await expect(store.exportState()).resolves.toMatchObject({
      teams: expect.arrayContaining([
        expect.objectContaining({ teamId: "og-12", questionCount: 7 }),
      ]),
      interactions: [],
      aiCallCount: 0,
    });
    await store.resetGame();
    await expect(store.getTeamState("og-12")).resolves.toMatchObject({
      questionCount: 0,
      solvedCases: [],
    });
  });

  it("giữ singleton client wrapper trên globalThis", () => {
    const first = getEventStore();
    const second = getEventStore();
    expect(second).toBe(first);

    resetEventStoreForTests();
    expect(getEventStore()).not.toBe(first);
  });
});
