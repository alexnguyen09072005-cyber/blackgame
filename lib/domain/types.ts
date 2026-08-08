export const INTERACTION_ITEM_TYPES = ["QUESTION", "FINAL_ANSWER"] as const;

export type InteractionItemType = (typeof INTERACTION_ITEM_TYPES)[number];

export const VERDICTS = [
  "DUNG",
  "SAI",
  "KHONG_QUAN_TRONG",
  "KHONG_THE_TRA_LOI",
] as const;

export type Verdict = (typeof VERDICTS)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const INTERACTION_STATUSES = [
  "PENDING",
  "AI_COMPLETE",
  "FINALIZED",
] as const;

export type InteractionStatus = (typeof INTERACTION_STATUSES)[number];

export type CaseFact = {
  id: string;
  text: string;
};

export type CaseDefinition = {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  publicStory: string;
  coreFacts: readonly CaseFact[];
  explicitFalseFacts: readonly CaseFact[];
  requiredCoreFacts: readonly CaseFact[];
  optionalFacts: readonly CaseFact[];
  acceptedAlternatives: readonly string[];
  irrelevantExamples: readonly string[];
  unsupportedDetails: readonly string[];
  needsReview: boolean;
  enabled: boolean;
  reviewNotes: readonly string[];
};

export type PublicCaseDefinition = Pick<
  CaseDefinition,
  | "id"
  | "number"
  | "title"
  | "difficulty"
  | "publicStory"
  | "enabled"
>;

export type TeamDefinition = {
  id: string;
  number: number;
  name: string;
  braceletColor: string;
  braceletColorHex: string;
  gmId: string;
};

export type GameMasterDefinition = {
  id: string;
  name: string;
  codeEnvironmentVariable: "GM1_CODE" | "GM2_CODE" | "GM3_CODE";
  teamIds: readonly string[];
};

export type AuthPrincipal =
  | { role: "GM"; gmId: string }
  | { role: "ADMIN" };

export type SolvedCase = {
  caseId: string;
  solvedAt: number;
  interactionId: string;
};

export type TeamState = {
  teamId: string;
  questionCount: number;
  turnItemsUsed: number;
  cooldownUntil: number | null;
  solvedCases: SolvedCase[];
  lastInteractionAt: number | null;
};

export type InteractionItem = {
  id: string;
  caseId: string;
  type: InteractionItemType;
  content: string;
};

export type AdjudicationResult = {
  itemId: string;
  itemType: InteractionItemType;
  verdict: Verdict | null;
  finalCorrect: boolean | null;
  confidence: Confidence;
  gmNote: string;
};

export type Interaction = {
  id: string;
  gmId: string;
  teamId: string;
  submittedAt: number;
  finalizedAt: number | null;
  status: InteractionStatus;
  items: InteractionItem[];
  aiResults: AdjudicationResult[] | null;
  finalResults: AdjudicationResult[] | null;
  aiError: string | null;
  model: string | null;
};

export type LeaderboardEntry = {
  teamId: string;
  teamNumber: number;
  teamName: string;
  solvedCount: number;
  achievementTime: number;
  questionCount: number;
};
