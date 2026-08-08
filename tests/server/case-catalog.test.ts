import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { serializePublicCases } from "../../lib/domain/cases";
import { caseDefinitionSchema } from "../../lib/domain/schemas";
import { buildAdjudicationPayload, AiAdjudicationError } from "../../lib/server/ai";
import {
  CASES,
  HAS_GAME_RULES,
  getCaseById,
} from "../../lib/server/cases";

const sourceRules = readFileSync(
  new URL("../../game.txt", import.meta.url),
  "utf8",
);

describe("catalog vụ án từ game.txt", () => {
  it("có đúng chín case theo thứ tự, hợp lệ và đều được bật", () => {
    expect(HAS_GAME_RULES).toBe(true);
    expect(CASES).toHaveLength(9);
    expect(CASES.map((caseDefinition) => caseDefinition.id)).toEqual(
      Array.from(
        { length: 9 },
        (_, index) => `case-${String(index + 1).padStart(2, "0")}`,
      ),
    );

    for (const caseDefinition of CASES) {
      expect(() => caseDefinitionSchema.parse(caseDefinition)).not.toThrow();
      expect(caseDefinition.enabled).toBe(true);
      expect(caseDefinition.coreFacts.length).toBeGreaterThan(0);
      expect(caseDefinition.requiredCoreFacts.length).toBeGreaterThan(0);
      expect(getCaseById(caseDefinition.id)).toBe(caseDefinition);
    }
  });

  it("giữ nguyên title, difficulty và đề công khai từ nguồn", () => {
    for (const caseDefinition of CASES) {
      expect(sourceRules).toContain(
        `Vụ án số ${caseDefinition.number}: ${caseDefinition.title}`,
      );
      expect(sourceRules).toContain(`Độ khó: ${caseDefinition.difficulty}`);
      expect(sourceRules).toContain(caseDefinition.publicStory);
    }
  });

  it("chỉ đánh dấu 2, 3 và 9 để Quản trò rà soát mâu thuẫn", () => {
    const needsReview = CASES.filter(
      (caseDefinition) => caseDefinition.needsReview,
    );

    expect(needsReview.map((caseDefinition) => caseDefinition.number)).toEqual([
      2, 3, 9,
    ]);
    for (const caseDefinition of needsReview) {
      expect(caseDefinition.reviewNotes.length).toBeGreaterThan(0);
      expect(caseDefinition.unsupportedDetails.length).toBeGreaterThan(0);
    }
  });

  it("serializer public dùng allowlist và không lộ dữ kiện chấm", () => {
    const publicCases = serializePublicCases(CASES);
    const allowedKeys = [
      "difficulty",
      "enabled",
      "id",
      "number",
      "publicStory",
      "title",
    ];

    expect(publicCases).toHaveLength(9);
    for (const publicCase of publicCases) {
      expect(Object.keys(publicCase).sort()).toEqual(allowedKeys);
      expect(publicCase.enabled).toBe(true);
      expect(publicCase).not.toHaveProperty("coreFacts");
      expect(publicCase).not.toHaveProperty("requiredCoreFacts");
      expect(publicCase).not.toHaveProperty("reviewNotes");
      expect(publicCase).not.toHaveProperty("needsReview");
    }
  });
});

describe("payload chấm server-only", () => {
  it("chỉ đưa mỗi case dùng trong batch một lần và giữ cảnh báo review", () => {
    const items = [
      {
        id: "item-1",
        caseId: "case-02",
        type: "QUESTION" as const,
        content: "Đó là tàu hỏa đúng không?",
      },
      {
        id: "item-2",
        caseId: "case-02",
        type: "FINAL_ANSWER" as const,
        content: "Anh ta tưởng mình bị mù trở lại.",
      },
      {
        id: "item-3",
        caseId: "case-09",
        type: "QUESTION" as const,
        content: "Kim báo nhiên liệu bị hỏng đúng không?",
      },
    ];

    const payload = buildAdjudicationPayload(items);

    expect(payload.items).toEqual(items);
    expect(payload.cases.map((caseDefinition) => caseDefinition.caseId)).toEqual([
      "case-02",
      "case-09",
    ]);
    for (const caseDefinition of payload.cases) {
      expect(caseDefinition.needsReview).toBe(true);
      expect(caseDefinition.reviewNotes.length).toBeGreaterThan(0);
      expect(caseDefinition.requiredCoreFacts.length).toBeGreaterThan(0);
    }
  });

  it("mọi case thật đều tạo được payload, case lạ fail-closed", () => {
    for (const caseDefinition of CASES) {
      expect(() =>
        buildAdjudicationPayload([
          {
            id: `item-${caseDefinition.number}`,
            caseId: caseDefinition.id,
            type: "QUESTION",
            content: "Đây là một câu hỏi Có/Không hợp lệ đúng không?",
          },
        ]),
      ).not.toThrow();
    }

    expect(() =>
      buildAdjudicationPayload([
        {
          id: "item-unknown",
          caseId: "case-99",
          type: "QUESTION",
          content: "Case này có tồn tại không?",
        },
      ]),
    ).toThrowError(AiAdjudicationError);
  });
});
