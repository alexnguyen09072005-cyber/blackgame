import { describe, expect, it } from "vitest";

import {
  finalAnswerResultToVietnamese,
  validateAdjudicationOutput,
  verdictToVietnamese,
} from "../../lib/domain/adjudication";
import type { InteractionItem } from "../../lib/domain/types";

const items: InteractionItem[] = [
  {
    id: "item-1",
    caseId: "case-01",
    type: "QUESTION",
    content: "Đây là câu hỏi?",
  },
  {
    id: "item-2",
    caseId: "case-02",
    type: "FINAL_ANSWER",
    content: "Đây là đáp án.",
  },
];

describe("kết quả chấm", () => {
  it("map verdict và đáp án cuối sang tiếng Việt", () => {
    expect(verdictToVietnamese("DUNG")).toBe("Có");
    expect(verdictToVietnamese("SAI")).toBe("Không");
    expect(verdictToVietnamese("KHONG_QUAN_TRONG")).toBe("Không quan trọng");
    expect(verdictToVietnamese("KHONG_THE_TRA_LOI")).toBe(
      "Không thể trả lời",
    );
    expect(finalAnswerResultToVietnamese(true)).toBe("Chính xác");
    expect(finalAnswerResultToVietnamese(false)).toBe("Chưa chính xác");
  });

  it("chấp nhận structured output có ánh xạ một-một chính xác", () => {
    const outcome = validateAdjudicationOutput(
      {
        results: [
          {
            itemId: "item-1",
            itemType: "QUESTION",
            verdict: "DUNG",
            finalCorrect: null,
            confidence: "HIGH",
            gmNote: "Mệnh đề khớp dữ kiện.",
          },
          {
            itemId: "item-2",
            itemType: "FINAL_ANSWER",
            verdict: null,
            finalCorrect: false,
            confidence: "MEDIUM",
            gmNote: "Còn thiếu dữ kiện cốt lõi.",
          },
        ],
      },
      items,
    );

    expect(outcome.mode).toBe("AI");
  });

  it("chuyển sang manual khi output sai shape, thiếu ID hoặc sai item type", () => {
    const invalidShape = validateAdjudicationOutput(
      {
        results: [
          {
            itemId: "item-1",
            itemType: "QUESTION",
            verdict: null,
            finalCorrect: true,
            confidence: "HIGH",
            gmNote: "Sai invariant.",
          },
        ],
      },
      items,
    );
    expect(invalidShape.mode).toBe("MANUAL");

    const duplicateId = validateAdjudicationOutput(
      {
        results: [
          {
            itemId: "item-1",
            itemType: "QUESTION",
            verdict: "DUNG",
            finalCorrect: null,
            confidence: "HIGH",
            gmNote: "",
          },
          {
            itemId: "item-1",
            itemType: "QUESTION",
            verdict: "SAI",
            finalCorrect: null,
            confidence: "LOW",
            gmNote: "",
          },
        ],
      },
      items,
    );
    expect(duplicateId.mode).toBe("MANUAL");
  });
});
