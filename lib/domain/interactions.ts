import { COOLDOWN_MS, MAX_TURN_ITEMS } from "../config/game";
import type {
  AdjudicationResult,
  Interaction,
  InteractionItem,
  SolvedCase,
  TeamState,
} from "./types";

export function createEmptyTeamState(teamId: string): TeamState {
  return {
    teamId,
    questionCount: 0,
    turnItemsUsed: 0,
    cooldownUntil: null,
    solvedCases: [],
    lastInteractionAt: null,
  };
}

export function countQuestionItems(items: readonly InteractionItem[]): number {
  return items.reduce(
    (count, item) => count + (item.type === "QUESTION" ? 1 : 0),
    0,
  );
}

export type CooldownStatus =
  | { active: false; retryAfterSeconds: 0 }
  | { active: true; retryAfterSeconds: number; cooldownUntil: number };

export function getCooldownStatus(
  teamState: TeamState,
  now: number,
): CooldownStatus {
  const cooldownUntil = teamState.cooldownUntil;

  if (cooldownUntil === null || cooldownUntil <= now) {
    return { active: false, retryAfterSeconds: 0 };
  }

  return {
    active: true,
    retryAfterSeconds: Math.ceil((cooldownUntil - now) / 1_000),
    cooldownUntil,
  };
}

export function isTeamOnCooldown(teamState: TeamState, now: number): boolean {
  return getCooldownStatus(teamState, now).active;
}

export type InteractionSubmissionPlan =
  | {
      kind: "CREATE";
      interaction: Interaction;
      nextTeamState: TeamState;
    }
  | {
      kind: "IDEMPOTENT_REPLAY";
      interaction: Interaction;
      nextTeamState: TeamState;
    }
  | {
      kind: "COOLDOWN";
      retryAfterSeconds: number;
      cooldownUntil: number;
    };

export type PlanInteractionSubmissionInput = {
  interactionId: string;
  gmId: string;
  teamId: string;
  items: readonly InteractionItem[];
  submittedAt: number;
  teamState: TeamState;
  existingInteraction?: Interaction | null;
  cooldownMs?: number;
};

function resetExpiredTurn(teamState: TeamState, now: number): TeamState {
  if (
    teamState.cooldownUntil === null ||
    teamState.cooldownUntil > now
  ) {
    return teamState;
  }

  return {
    ...teamState,
    turnItemsUsed: 0,
    cooldownUntil: null,
  };
}

/**
 * Plans the state transition after authorization and validation. Persistence
 * still has to commit this plan atomically in the selected server store.
 */
export function planInteractionSubmission({
  interactionId,
  gmId,
  teamId,
  items,
  submittedAt,
  teamState,
  existingInteraction = null,
  cooldownMs = COOLDOWN_MS,
}: PlanInteractionSubmissionInput): InteractionSubmissionPlan {
  if (teamState.teamId !== teamId) {
    throw new Error("Trạng thái OG không khớp với lượt gửi.");
  }

  const currentTeamState = resetExpiredTurn(teamState, submittedAt);

  if (existingInteraction) {
    if (
      existingInteraction.id !== interactionId ||
      existingInteraction.teamId !== teamId
    ) {
      throw new Error("Mã lượt đã được dùng cho một lượt khác.");
    }

    return {
      kind: "IDEMPOTENT_REPLAY",
      interaction: existingInteraction,
      nextTeamState: currentTeamState,
    };
  }

  const cooldown = getCooldownStatus(currentTeamState, submittedAt);
  if (cooldown.active) {
    return {
      kind: "COOLDOWN",
      retryAfterSeconds: cooldown.retryAfterSeconds,
      cooldownUntil: cooldown.cooldownUntil,
    };
  }

  const interaction: Interaction = {
    id: interactionId,
    gmId,
    teamId,
    submittedAt,
    finalizedAt: null,
    status: "PENDING",
    items: items.map((item) => ({ ...item })),
    aiResults: null,
    finalResults: null,
    aiError: null,
    model: null,
  };

  const turnItemsUsed = currentTeamState.turnItemsUsed + 1;

  return {
    kind: "CREATE",
    interaction,
    nextTeamState: {
      ...currentTeamState,
      questionCount:
        currentTeamState.questionCount + countQuestionItems(items),
      turnItemsUsed,
      cooldownUntil:
        turnItemsUsed >= MAX_TURN_ITEMS ? submittedAt + cooldownMs : null,
      lastInteractionAt: submittedAt,
    },
  };
}

export function addSolvedCaseOnce(
  teamState: TeamState,
  solvedCase: SolvedCase,
): TeamState {
  if (
    teamState.solvedCases.some(
      (existing) => existing.caseId === solvedCase.caseId,
    )
  ) {
    return teamState;
  }

  return {
    ...teamState,
    solvedCases: [...teamState.solvedCases, solvedCase],
  };
}

/**
 * Reduces all correct solve candidates to one deterministic winner per case.
 * The earliest submitted interaction wins, regardless of review/finalize order.
 */
export function selectEarliestSolvedCases(
  candidates: readonly SolvedCase[],
): SolvedCase[] {
  const earliestByCase = new Map<string, SolvedCase>();

  for (const candidate of candidates) {
    const current = earliestByCase.get(candidate.caseId);
    if (
      !current ||
      candidate.solvedAt < current.solvedAt ||
      (candidate.solvedAt === current.solvedAt &&
        candidate.interactionId < current.interactionId)
    ) {
      earliestByCase.set(candidate.caseId, { ...candidate });
    }
  }

  return [...earliestByCase.values()].sort((left, right) =>
    left.caseId.localeCompare(right.caseId),
  );
}

/** Adds each correctly solved FINAL_ANSWER once, using submittedAt for fairness. */
export function recordSolvedCasesFromResults(
  teamState: TeamState,
  interaction: Interaction,
  results: readonly AdjudicationResult[],
): TeamState {
  if (teamState.teamId !== interaction.teamId) {
    throw new Error("Trạng thái OG không khớp với lượt chấm.");
  }

  const itemById = new Map(interaction.items.map((item) => [item.id, item]));
  let nextState = teamState;

  for (const result of results) {
    const item = itemById.get(result.itemId);
    if (
      !item ||
      item.type !== "FINAL_ANSWER" ||
      result.itemType !== "FINAL_ANSWER" ||
      result.finalCorrect !== true
    ) {
      continue;
    }

    nextState = addSolvedCaseOnce(nextState, {
      caseId: item.caseId,
      solvedAt: interaction.submittedAt,
      interactionId: interaction.id,
    });
  }

  return nextState;
}
