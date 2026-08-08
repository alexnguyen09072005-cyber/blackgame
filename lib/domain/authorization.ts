import { getGameMasterById } from "../config/teams";
import type { AuthPrincipal } from "./types";

export function getAssignedTeamIds(gmId: string): readonly string[] {
  return getGameMasterById(gmId)?.teamIds ?? [];
}

export function gmOwnsTeam(gmId: string, teamId: string): boolean {
  return getAssignedTeamIds(gmId).includes(teamId);
}

export function canAccessTeam(
  principal: AuthPrincipal,
  teamId: string,
): boolean {
  return principal.role === "ADMIN" || gmOwnsTeam(principal.gmId, teamId);
}
