import { describe, expect, it } from "vitest";

import { serializePublicCase } from "../../lib/domain/cases";
import type { CaseDefinition } from "../../lib/domain/types";

const secretCase: CaseDefinition = {
  id: "case-01",
  number: 1,
  title: "Vụ thử nghiệm",
  difficulty: "Dễ",
  publicStory: "Một câu chuyện công khai.",
  coreFacts: [{ id: "fact-1", text: "Bí mật cốt lõi" }],
  explicitFalseFacts: [{ id: "false-1", text: "Dữ kiện phủ định" }],
  requiredCoreFacts: [{ id: "required-1", text: "Đáp án bí mật" }],
  optionalFacts: [{ id: "optional-1", text: "Chi tiết tùy chọn" }],
  acceptedAlternatives: ["Cách diễn đạt bí mật"],
  irrelevantExamples: ["Ví dụ không quan trọng"],
  unsupportedDetails: ["Chi tiết chưa xác định"],
  needsReview: false,
  enabled: true,
  reviewNotes: ["Ghi chú nội bộ"],
};

describe("public case serialization", () => {
  it("chỉ trả allowlist công khai và không lộ trường bí mật", () => {
    const serialized = serializePublicCase(secretCase);

    expect(serialized).toEqual({
      id: "case-01",
      number: 1,
      title: "Vụ thử nghiệm",
      difficulty: "Dễ",
      publicStory: "Một câu chuyện công khai.",
      enabled: true,
    });
    expect(serialized).not.toHaveProperty("coreFacts");
    expect(serialized).not.toHaveProperty("requiredCoreFacts");
    expect(serialized).not.toHaveProperty("reviewNotes");
    expect(serialized).not.toHaveProperty("needsReview");
  });
});
