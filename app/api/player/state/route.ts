import {
  publicPlayerCases,
  serializePlayerInteraction,
  serializePlayerTeam,
} from "@/app/api/player/_shared";
import { requireSession } from "@/lib/server/auth";
import { jsonOk, withApiErrors } from "@/lib/server/http";
import { getEventStore } from "@/lib/server/store";

export const GET = withApiErrors(async () => {
  const principal = await requireSession();
  const store = getEventStore();
  const [teamState, interactions, cases] = await Promise.all([
    store.getTeamState(principal.teamId),
    store.getTeamInteractions(principal.teamId),
    publicPlayerCases(),
  ]);
  return jsonOk({
    team: serializePlayerTeam(teamState),
    cases,
    interactions: interactions.map(serializePlayerInteraction),
  });
});
