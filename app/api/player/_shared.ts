import "server-only";

import { AI_PENDING_STALE_MS, MAX_TURN_ITEMS } from "@/lib/config/game";
import { getTeamById } from "@/lib/config/teams";
import type {
  AdjudicationResult,
  CaseDefinition,
  InteractionItem,
  TeamState,
} from "@/lib/domain/types";
import {
  CASES,
  HAS_GAME_RULES,
  serializePublicCases,
} from "@/lib/server/cases";
import type { StoredInteraction } from "@/lib/server/store";

export type PlayerResult = Pick<
  AdjudicationResult,
  "itemId" | "itemType" | "verdict" | "finalCorrect"
>;

export type PlayerInteraction = {
  id: string;
  teamId: string;
  submittedAt: number;
  finalizedAt: number | null;
  status: "PENDING" | "FINALIZED" | "FAILED";
  items: InteractionItem[];
  results: PlayerResult[] | null;
};

export function effectivePlayerCases(): CaseDefinition[] {
  return CASES.map((caseDefinition) => ({
    ...caseDefinition,
    enabled: HAS_GAME_RULES && caseDefinition.enabled,
  }));
}

export function publicPlayerCases() {
  return serializePublicCases(effectivePlayerCases());
}

export function serializePlayerResults(
  results: readonly AdjudicationResult[] | null,
): PlayerResult[] | null {
  if (!results) {
    return null;
  }
  return results.map((result) => ({
    itemId: result.itemId,
    itemType: result.itemType,
    verdict: result.verdict,
    finalCorrect: result.finalCorrect,
  }));
}

/** A claimed call cannot be retried without risking a second OpenAI charge. */
export function isStalePlayerInteraction(
  interaction: StoredInteraction,
  now = Date.now(),
): boolean {
  return (
    interaction.status !== "FINALIZED" &&
    interaction.aiAttempts >= 1 &&
    !interaction.aiResults &&
    !interaction.aiError &&
    now - (interaction.aiStartedAt ?? interaction.submittedAt) >=
      AI_PENDING_STALE_MS
  );
}

/** Explicit allowlist: never expose gmNote, confidence, model, gmId or aiError. */
export function serializePlayerInteraction(
  interaction: StoredInteraction,
): PlayerInteraction {
  const results = interaction.finalResults ?? interaction.aiResults;
  return {
    id: interaction.id,
    teamId: interaction.teamId,
    submittedAt: interaction.submittedAt,
    finalizedAt: interaction.finalizedAt,
    status:
      interaction.status === "FINALIZED"
        ? "FINALIZED"
        : interaction.aiError || isStalePlayerInteraction(interaction)
          ? "FAILED"
          : "PENDING",
    items: interaction.items.map((item) => ({ ...item })),
    results: serializePlayerResults(results),
  };
}

export function serializePlayerTeam(teamState: TeamState) {
  const team = getTeamById(teamState.teamId);
  if (!team) {
    throw new Error("Unknown team in player state");
  }
  const turnItemsUsed = Math.min(
    MAX_TURN_ITEMS,
    Math.max(0, teamState.turnItemsUsed),
  );
  return {
    id: team.id,
    teamId: team.id,
    number: team.number,
    teamNumber: team.number,
    name: team.name,
    color: team.braceletColorHex,
    wristbandColor: team.braceletColor,
    questionCount: teamState.questionCount,
    cooldownUntil: teamState.cooldownUntil,
    turnItemsUsed,
    turnItemsRemaining: MAX_TURN_ITEMS - turnItemsUsed,
    solvedCount: teamState.solvedCases.length,
    solvedCases: teamState.solvedCases.map((solved) => ({ ...solved })),
    lastInteractionAt: teamState.lastInteractionAt,
  };
}
