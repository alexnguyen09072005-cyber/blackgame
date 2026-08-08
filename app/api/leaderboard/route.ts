import { TEAMS } from "@/lib/config/teams";
import { createLeaderboardEntry, sortLeaderboard } from "@/lib/domain/ranking";
import { jsonOk, withApiErrors } from "@/lib/server/http";
import { getEventStore } from "@/lib/server/store";

export const GET = withApiErrors(async () => {
  const states = await getEventStore().getAllTeamStates();
  const entries = states.map((state) => {
    const definition = TEAMS.find((team) => team.id === state.teamId);
    if (!definition) {
      throw new Error("Unknown team in leaderboard state");
    }
    return createLeaderboardEntry(state, definition);
  });
  const leaderboard = sortLeaderboard(entries).map((entry, index) => {
    const definition = TEAMS.find((team) => team.id === entry.teamId)!;
    return {
      rank: index + 1,
      teamId: entry.teamId,
      teamNumber: entry.teamNumber,
      name: entry.teamName,
      color: definition.braceletColorHex,
      solvedCount: entry.solvedCount,
      questionCount: entry.questionCount,
      achievementTime: Number.isFinite(entry.achievementTime)
        ? entry.achievementTime
        : null,
    };
  });
  return jsonOk({ leaderboard });
});
