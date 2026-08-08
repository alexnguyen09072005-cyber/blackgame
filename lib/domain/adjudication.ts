import { adjudicationBatchSchema } from "./schemas";
import type { AdjudicationResult, InteractionItem, Verdict } from "./types";

export const VERDICT_LABELS: Readonly<Record<Verdict, string>> = {
  DUNG: "Có",
  SAI: "Không",
  KHONG_QUAN_TRONG: "Không quan trọng",
  KHONG_THE_TRA_LOI: "Không thể trả lời",
};

export function verdictToVietnamese(verdict: Verdict): string {
  return VERDICT_LABELS[verdict];
}

export function finalAnswerResultToVietnamese(finalCorrect: boolean): string {
  return finalCorrect ? "Chính xác" : "Chưa chính xác";
}

export type AdjudicationValidationOutcome =
  | {
      mode: "AI";
      results: AdjudicationResult[];
    }
  | {
      mode: "MANUAL";
      reason: "INVALID_AI_OUTPUT";
      errors: string[];
    };

function manualOutcome(errors: string[]): AdjudicationValidationOutcome {
  return {
    mode: "MANUAL",
    reason: "INVALID_AI_OUTPUT",
    errors,
  };
}

/**
 * Structured output validation has two layers: JSON shape, followed by exact
 * one-to-one correspondence with the submitted batch.
 */
export function validateAdjudicationOutput(
  rawOutput: unknown,
  items: readonly InteractionItem[],
): AdjudicationValidationOutcome {
  const parsed = adjudicationBatchSchema.safeParse(rawOutput);

  if (!parsed.success) {
    return manualOutcome(parsed.error.issues.map((issue) => issue.message));
  }

  const results = parsed.data.results;
  if (results.length !== items.length) {
    return manualOutcome([
      "AI không trả về đúng một kết quả cho mỗi nội dung.",
    ]);
  }

  const inputById = new Map(items.map((item) => [item.id, item]));
  const resultIds = new Set<string>();

  for (const result of results) {
    if (resultIds.has(result.itemId)) {
      return manualOutcome(["AI trả về mã nội dung bị trùng."]);
    }
    resultIds.add(result.itemId);

    const input = inputById.get(result.itemId);
    if (!input) {
      return manualOutcome(["AI trả về kết quả không thuộc lượt này."]);
    }
    if (input.type !== result.itemType) {
      return manualOutcome(["AI trả về sai loại nội dung."]);
    }
  }

  if (items.some((item) => !resultIds.has(item.id))) {
    return manualOutcome(["AI bỏ sót nội dung trong lượt."]);
  }

  return { mode: "AI", results: [...results] };
}
