import "server-only";

import { COOLDOWN_MS, MAX_TURN_ITEMS } from "../config/game";
import { TEAMS, getTeamById } from "../config/teams";
import { selectEarliestSolvedCases } from "../domain/interactions";
import type {
  AdjudicationResult,
  Interaction,
  InteractionItem,
  SolvedCase,
  TeamState,
} from "../domain/types";

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

function cloneTeamState(state: TeamState): TeamState {
  return {
    ...state,
    solvedCases: state.solvedCases.map((solved) => ({ ...solved })),
  };
}

function cloneResults(
  results: readonly AdjudicationResult[] | null,
): AdjudicationResult[] | null {
  return results?.map((result) => ({ ...result })) ?? null;
}

function cloneInteraction(interaction: StoredInteraction): StoredInteraction {
  return {
    ...interaction,
    items: interaction.items.map((item) => ({ ...item })),
    aiResults: cloneResults(interaction.aiResults),
    finalResults: cloneResults(interaction.finalResults),
  };
}

function questionIncrement(items: readonly InteractionItem[]): number {
  return items.reduce(
    (total, item) => total + (item.type === "QUESTION" ? 1 : 0),
    0,
  );
}

function solvedCandidates(
  interaction: StoredInteraction,
  results: readonly AdjudicationResult[],
): SolvedCase[] {
  const itemById = new Map(interaction.items.map((item) => [item.id, item]));
  const caseIds = new Set<string>();
  for (const result of results) {
    const item = itemById.get(result.itemId);
    if (
      item?.type === "FINAL_ANSWER" &&
      result.itemType === "FINAL_ANSWER" &&
      result.finalCorrect === true
    ) {
      caseIds.add(item.caseId);
    }
  }
  return [...caseIds].map((caseId) => ({
    caseId,
    solvedAt: interaction.submittedAt,
    interactionId: interaction.id,
  }));
}

/**
 * Process-local storage for the small, single-event game state.
 *
 * Every mutation completes synchronously before its Promise is returned. That
 * keeps the read/check/write transition atomic against other requests running
 * in the same JavaScript process. It does not coordinate separate processes or
 * serverless instances and all state is lost when the process is restarted.
 */
export class MemoryEventStore implements EventStore {
  private readonly teamStates = new Map<string, TeamState>();
  private readonly interactions = new Map<string, StoredInteraction>();
  private readonly caseEnabledOverrides = new Map<string, boolean>();
  private aiCallCount = 0;

  constructor() {
    this.initializeTeams();
  }

  private initializeTeams(): void {
    this.teamStates.clear();
    for (const team of TEAMS) {
      this.teamStates.set(team.id, defaultTeamState(team.id));
    }
  }

  private requireTeamState(teamId: string): TeamState {
    const state = this.teamStates.get(teamId);
    if (!state) {
      throw new Error("Unknown team");
    }
    return state;
  }

  private refreshExpiredTurn(state: TeamState, now: number): void {
    if (state.cooldownUntil !== null && state.cooldownUntil <= now) {
      state.cooldownUntil = null;
      state.turnItemsUsed = 0;
    }
  }

  async getTeamState(teamId: string): Promise<TeamState> {
    const state = this.requireTeamState(teamId);
    this.refreshExpiredTurn(state, Date.now());
    return cloneTeamState(state);
  }

  async getAllTeamStates(): Promise<TeamState[]> {
    const now = Date.now();
    return TEAMS.map((team) => {
      const state = this.requireTeamState(team.id);
      this.refreshExpiredTurn(state, now);
      return cloneTeamState(state);
    });
  }

  async getInteraction(
    interactionId: string,
  ): Promise<StoredInteraction | null> {
    const interaction = this.interactions.get(interactionId);
    return interaction ? cloneInteraction(interaction) : null;
  }

  async getTeamInteractions(teamId: string): Promise<StoredInteraction[]> {
    return [...this.interactions.values()]
      .filter((interaction) => interaction.teamId === teamId)
      .sort(
        (left, right) =>
          right.submittedAt - left.submittedAt ||
          left.id.localeCompare(right.id),
      )
      .map(cloneInteraction);
  }

  async getAllInteractions(): Promise<StoredInteraction[]> {
    return [...this.interactions.values()]
      .sort(
        (left, right) =>
          right.submittedAt - left.submittedAt ||
          left.id.localeCompare(right.id),
      )
      .map(cloneInteraction);
  }

  async createInteraction(input: {
    id: string;
    gmId: string;
    teamId: string;
    items: InteractionItem[];
    now?: number;
  }): Promise<InteractionCreationResult> {
    const teamState = this.requireTeamState(input.teamId);
    const now = input.now ?? Date.now();
    this.refreshExpiredTurn(teamState, now);

    const existing = this.interactions.get(input.id);
    if (existing) {
      return {
        kind: "EXISTING",
        value: { interaction: cloneInteraction(existing), duplicate: true },
      };
    }

    if (
      teamState.cooldownUntil !== null &&
      teamState.cooldownUntil > now
    ) {
      return { kind: "COOLDOWN", cooldownUntil: teamState.cooldownUntil };
    }

    const submittedCaseIds = new Set(input.items.map((item) => item.caseId));
    const solvedCase = teamState.solvedCases.find((solved) =>
      submittedCaseIds.has(solved.caseId),
    );
    if (solvedCase) {
      return { kind: "CASE_SOLVED", caseId: solvedCase.caseId };
    }

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

    this.interactions.set(interaction.id, interaction);
    teamState.questionCount += questionIncrement(interaction.items);
    teamState.turnItemsUsed += 1;
    teamState.cooldownUntil =
      teamState.turnItemsUsed >= MAX_TURN_ITEMS ? now + COOLDOWN_MS : null;
    teamState.lastInteractionAt = now;

    return {
      kind: "CREATED",
      value: { interaction: cloneInteraction(interaction), duplicate: false },
    };
  }

  async beginAiAttempt(
    interactionId: string,
    now = Date.now(),
  ): Promise<number | null> {
    const interaction = this.interactions.get(interactionId);
    if (
      !interaction ||
      interaction.status === "FINALIZED" ||
      interaction.aiAttempts >= 1
    ) {
      return null;
    }

    interaction.aiAttempts = 1;
    interaction.aiStartedAt = now;
    return interaction.aiAttempts;
  }

  async failStaleAiAttempt(
    interactionId: string,
    staleBefore: number,
  ): Promise<StoredInteraction | null> {
    const interaction = this.interactions.get(interactionId);
    if (
      !interaction ||
      interaction.status === "FINALIZED" ||
      interaction.aiAttempts < 1 ||
      interaction.aiResults !== null ||
      interaction.aiError !== null ||
      (interaction.aiStartedAt ?? interaction.submittedAt) > staleBefore
    ) {
      return null;
    }

    interaction.aiError =
      "AI_STALE: Tiến trình chấm đã kết thúc trước khi lưu được kết quả.";
    return cloneInteraction(interaction);
  }

  async saveAiSuccess(
    interactionId: string,
    results: AdjudicationResult[],
    model: string,
  ): Promise<StoredInteraction | null> {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) {
      return null;
    }

    interaction.aiResults = cloneResults(results);
    interaction.aiError = null;
    interaction.model = model;
    if (interaction.status !== "FINALIZED") {
      interaction.status = "AI_COMPLETE";
    }
    return cloneInteraction(interaction);
  }

  async saveAiError(
    interactionId: string,
    safeError: string,
    model: string | null = null,
  ): Promise<StoredInteraction | null> {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) {
      return null;
    }

    interaction.aiResults = null;
    interaction.aiError = safeError.slice(0, 300);
    if (model !== null) {
      interaction.model = model;
    }
    return cloneInteraction(interaction);
  }

  async reserveAiCall(maxCalls: number): Promise<number | null> {
    const maximum = Number.isFinite(maxCalls)
      ? Math.max(0, Math.trunc(maxCalls))
      : 0;
    if (this.aiCallCount >= maximum) {
      return null;
    }

    this.aiCallCount += 1;
    return this.aiCallCount;
  }

  async getAiCallCount(): Promise<number> {
    return this.aiCallCount;
  }

  async finalizeInteraction(
    interactionId: string,
    results: AdjudicationResult[],
    options: { allowUpdate?: boolean; now?: number } = {},
  ): Promise<StoredInteraction | null> {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) {
      return null;
    }
    if (interaction.status === "FINALIZED" && !options.allowUpdate) {
      return cloneInteraction(interaction);
    }

    const teamState = this.requireTeamState(interaction.teamId);
    const retainedSolvedCases = options.allowUpdate
      ? teamState.solvedCases.filter(
          (solved) => solved.interactionId !== interaction.id,
        )
      : teamState.solvedCases;
    teamState.solvedCases = selectEarliestSolvedCases([
      ...retainedSolvedCases,
      ...solvedCandidates(interaction, results),
    ]);

    interaction.finalResults = cloneResults(results);
    interaction.finalizedAt = options.now ?? Date.now();
    interaction.status = "FINALIZED";
    return cloneInteraction(interaction);
  }

  async resetCooldown(teamId: string): Promise<TeamState> {
    const state = this.requireTeamState(teamId);
    state.cooldownUntil = null;
    state.turnItemsUsed = 0;
    return cloneTeamState(state);
  }

  async setQuestionCount(
    teamId: string,
    questionCount: number,
  ): Promise<TeamState> {
    const state = this.requireTeamState(teamId);
    state.questionCount = Number.isFinite(questionCount)
      ? Math.max(0, Math.trunc(questionCount))
      : 0;
    return cloneTeamState(state);
  }

  async markSolved(
    teamId: string,
    caseId: string,
    solvedAt = Date.now(),
  ): Promise<TeamState> {
    const state = this.requireTeamState(teamId);
    if (!state.solvedCases.some((solved) => solved.caseId === caseId)) {
      state.solvedCases.push({
        caseId,
        solvedAt,
        interactionId: `admin-${solvedAt}`,
      });
    }
    return cloneTeamState(state);
  }

  async unmarkSolved(teamId: string, caseId: string): Promise<TeamState> {
    const state = this.requireTeamState(teamId);
    state.solvedCases = state.solvedCases.filter(
      (solved) => solved.caseId !== caseId,
    );
    return cloneTeamState(state);
  }

  async setCaseEnabled(caseId: string, enabled: boolean): Promise<void> {
    this.caseEnabledOverrides.set(caseId, enabled);
  }

  async getCaseEnabledOverrides(): Promise<Record<string, boolean>> {
    return Object.fromEntries(this.caseEnabledOverrides);
  }

  async exportState(): Promise<EventExport> {
    return {
      exportedAt: Date.now(),
      teams: await this.getAllTeamStates(),
      interactions: await this.getAllInteractions(),
      caseEnabledOverrides: await this.getCaseEnabledOverrides(),
      aiCallCount: this.aiCallCount,
    };
  }

  async resetGame(): Promise<void> {
    this.interactions.clear();
    this.caseEnabledOverrides.clear();
    this.aiCallCount = 0;
    this.initializeTeams();
  }
}

const globalStore = globalThis as typeof globalThis & {
  __blackgameMemoryEventStore?: MemoryEventStore;
};

export function getEventStore(): EventStore {
  globalStore.__blackgameMemoryEventStore ??= new MemoryEventStore();
  return globalStore.__blackgameMemoryEventStore;
}

export function resetEventStoreForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Chỉ được reset event store trong môi trường test.");
  }
  delete globalStore.__blackgameMemoryEventStore;
}
