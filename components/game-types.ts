export type PublicCase = {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  publicStory: string;
  enabled: boolean;
};

export type SolvedCase = {
  caseId: string;
  solvedAt: number;
  interactionId: string;
};

export type TeamSummary = {
  id?: string;
  teamId: string;
  number?: number;
  teamNumber: number;
  name: string;
  color: string;
  wristbandColor?: string;
  solvedCount: number;
  totalCases?: number;
  questionCount: number;
  turnItemsUsed: number;
  turnItemsRemaining: number;
  cooldownUntil: number | null;
  lastInteractionAt: number | null;
  solvedCases?: SolvedCase[];
};

export type InteractionItemType = "QUESTION" | "FINAL_ANSWER";

export type InteractionItem = {
  id: string;
  caseId: string;
  type: InteractionItemType;
  content: string;
};

export type QuestionVerdict =
  | "DUNG"
  | "SAI"
  | "KHONG_QUAN_TRONG"
  | "KHONG_THE_TRA_LOI";

export type LeaderboardEntry = {
  rank: number;
  teamId: string;
  teamNumber: number;
  name: string;
  color: string;
  solvedCount: number;
  questionCount: number;
  achievementTime: number | null;
  isMine?: boolean;
};

export const VERDICT_LABELS: Record<QuestionVerdict, string> = {
  DUNG: "Có",
  SAI: "Không",
  KHONG_QUAN_TRONG: "Không quan trọng",
  KHONG_THE_TRA_LOI: "Không thể trả lời",
};

export function braceletSwatch(label: string | null | undefined): string {
  const value = label?.trim() || "";
  if (/^(#(?:[\da-f]{3,8})|rgb(?:a)?\(|hsl(?:a)?\()/i.test(value)) return value;
  const normalized = value.toLocaleLowerCase("vi-VN");
  const namedColors: Array<[string, string]> = [
    ["xanh dương", "#3b82f6"],
    ["xanh lá", "#22c55e"],
    ["xanh ngọc", "#14b8a6"],
    ["xanh", "#0ea5e9"],
    ["đỏ", "#ef4444"],
    ["vàng", "#facc15"],
    ["cam", "#f97316"],
    ["tím", "#a855f7"],
    ["hồng", "#ec4899"],
    ["trắng", "#f5f5f4"],
    ["đen", "#171717"],
    ["xám", "#78716c"],
    ["nâu", "#92400e"],
  ];
  return namedColors.find(([name]) => normalized.includes(name))?.[1] || "#78716c";
}
