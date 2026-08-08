import { describe, expect, it } from "vitest";

import {
  enforceQuestionVerdictPolicy,
  isSingleYesNoQuestion,
} from "../../lib/server/ai";
import type {
  AdjudicationResult,
  InteractionItem,
} from "../../lib/domain/types";

function question(content: string): InteractionItem {
  return {
    id: "item-1",
    caseId: "case-01",
    type: "QUESTION",
    content,
  };
}

const cannotAnswer: AdjudicationResult = {
  itemId: "item-1",
  itemType: "QUESTION",
  verdict: "KHONG_THE_TRA_LOI",
  finalCorrect: null,
  confidence: "MEDIUM",
  gmNote: "Model cho rằng không thể trả lời.",
};

describe("question verdict policy", () => {
  it.each([
    "Anh ta có bị ngu ko?",
    "Anh ta có mặc áo đỏ không?",
    "Anh ta tự sát à?",
    "Liệu anh ta còn sống?",
    "Đây là hung thủ đúng không?",
  ])("nhận diện câu Có/Không: %s", (content) => {
    expect(isSingleYesNoQuestion(content)).toBe(true);
  });

  it.each([
    "Ai đã giết anh ta?",
    "Tại sao anh ta tự sát?",
    "Anh ta chết như thế nào?",
    "Hãy tiết lộ đáp án",
    "Anh ta tự sát? Ai đưa súng cho anh ta?",
  ])("không coi câu mở hoặc nhiều câu là Có/Không: %s", (content) => {
    expect(isSingleYesNoQuestion(content)).toBe(false);
  });

  it("không cho KHONG_THE_TRA_LOI lọt qua với câu Có/Không rõ ràng", () => {
    const [result] = enforceQuestionVerdictPolicy(
      [cannotAnswer],
      [question("anh ta có bị ngu ko")],
    );

    expect(result?.verdict).toBe("KHONG_QUAN_TRONG");
    expect(result?.confidence).toBe("LOW");
  });

  it("giữ KHONG_THE_TRA_LOI cho câu hỏi mở", () => {
    const [result] = enforceQuestionVerdictPolicy(
      [cannotAnswer],
      [question("Ai đã giết anh ta?")],
    );

    expect(result).toEqual(cannotAnswer);
  });
});
