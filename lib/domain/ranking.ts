import type {
  LeaderboardEntry,
  SolvedCase,
  TeamDefinition,
  TeamState,
} from "./types";

export function getAchievementTime(solvedCases: readonly SolvedCase[]): number {
  if (solvedCases.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(...solvedCases.map((solvedCase) => solvedCase.solvedAt));
}

export function createLeaderboardEntry(
  teamState: TeamState,
  teamDefinition: TeamDefinition,
): LeaderboardEntry {
  if (teamState.teamId !== teamDefinition.id) {
    throw new Error("Trạng thái và cấu hình OG không khớp.");
  }

  return {
    teamId: teamDefinition.id,
    teamNumber: teamDefinition.number,
    teamName: teamDefinition.name,
    solvedCount: teamState.solvedCases.length,
    achievementTime: getAchievementTime(teamState.solvedCases),
    questionCount: teamState.questionCount,
  };
}

export function compareLeaderboardEntries(
  left: LeaderboardEntry,
  right: LeaderboardEntry,
): number {
  return (
    right.solvedCount - left.solvedCount ||
    left.achievementTime - right.achievementTime ||
    left.questionCount - right.questionCount ||
    left.teamNumber - right.teamNumber
  );
}

export function sortLeaderboard(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries].sort(compareLeaderboardEntries);
}
