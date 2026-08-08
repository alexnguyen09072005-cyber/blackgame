import { describe, expect, it } from "vitest";

import { createInteractionSubmissionSchema } from "../../lib/domain/validation";

const baseSubmission = {
  interactionId: "00000000-0000-4000-8000-000000000001",
  teamId: "og-01",
  items: [
    {
      id: "item-1",
      caseId: "case-01",
      type: "QUESTION" as const,
      content: "  Đây là câu hỏi?  ",
    },
    {
      id: "item-2",
      caseId: "case-02",
      type: "FINAL_ANSWER" as const,
      content: "Đây là đáp án cuối.",
    },
  ],
};

describe("validation lượt chơi", () => {
  it("chấp nhận batch nhiều case khi config bật và trim nội dung", () => {
    const schema = createInteractionSubmissionSchema({
      allowMixedCases: true,
      knownCaseIds: new Set(["case-01", "case-02"]),
      enabledCaseIds: new Set(["case-01", "case-02"]),
      solvedCaseIds: new Set(),
    });

    const parsed = schema.safeParse(baseSubmission);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0]?.content).toBe("Đây là câu hỏi?");
    }
  });

  it("từ chối batch nhiều case khi config tắt", () => {
    const schema = createInteractionSubmissionSchema({
      allowMixedCases: false,
    });

    const parsed = schema.safeParse(baseSubmission);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message)).toContain(
        "Các nội dung trong lượt phải thuộc cùng một vụ án.",
      );
    }
  });

  it("từ chối case đã giải, chưa tồn tại hoặc đang bị khóa", () => {
    const schema = createInteractionSubmissionSchema({
      allowMixedCases: true,
      knownCaseIds: new Set(["case-01", "case-02"]),
      enabledCaseIds: new Set(["case-01"]),
      solvedCaseIds: new Set(["case-01"]),
    });
    const submission = {
      ...baseSubmission,
      items: [
        baseSubmission.items[0],
        baseSubmission.items[1],
        {
          id: "item-3",
          caseId: "case-99",
          type: "QUESTION" as const,
          content: "Case này có tồn tại không?",
        },
      ],
    };

    const parsed = schema.safeParse(submission);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      expect(messages).toContain("OG đã giải vụ án này.");
      expect(messages).toContain(
        "Vụ án này đang tạm khóa để kiểm tra nội dung.",
      );
      expect(messages).toContain("Không tìm thấy vụ án.");
    }
  });
});
