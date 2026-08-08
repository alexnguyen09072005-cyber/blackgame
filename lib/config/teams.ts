import type { GameMasterDefinition, TeamDefinition } from "../domain/types";

const placeholderColor = (teamNumber: number) =>
  `Chưa cấu hình màu ${String(teamNumber).padStart(2, "0")}`;

// Màu hiển thị chỉ là placeholder giúp phân biệt card trong lúc setup.
// Thay cả tên và mã màu theo vòng tay thật trước event.
const PLACEHOLDER_COLOR_HEX = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f4f4f5",
  "#a1a1aa",
] as const;

export const TEAMS = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  const paddedNumber = String(number).padStart(2, "0");
  const gmNumber = Math.floor(index / 4) + 1;

  return {
    id: `og-${paddedNumber}`,
    number,
    name: `OG ${paddedNumber}`,
    braceletColor: placeholderColor(number),
    braceletColorHex: PLACEHOLDER_COLOR_HEX[index]!,
    gmId: `gm-${gmNumber}`,
  } satisfies TeamDefinition;
}) as readonly TeamDefinition[];

export const GAME_MASTERS = [1, 2, 3].map((gmNumber) => ({
  id: `gm-${gmNumber}`,
  name: `GM ${gmNumber}`,
  codeEnvironmentVariable: `GM${gmNumber}_CODE` as
    | "GM1_CODE"
    | "GM2_CODE"
    | "GM3_CODE",
  teamIds: TEAMS.filter((team) => team.gmId === `gm-${gmNumber}`).map(
    (team) => team.id,
  ),
})) as readonly GameMasterDefinition[];

export function getTeamById(teamId: string): TeamDefinition | undefined {
  return TEAMS.find((team) => team.id === teamId);
}

export function getGameMasterById(
  gmId: string,
): GameMasterDefinition | undefined {
  return GAME_MASTERS.find((gameMaster) => gameMaster.id === gmId);
}
