import { describe, expect, it } from "vitest";

import {
  isStalePlayerInteraction,
  serializePlayerInteraction,
  serializePlayerResults,
  serializePlayerTeam,
} from "../../app/api/player/_shared";
import type { StoredInteraction } from "../../lib/server/store";

describe("player API serializer", () => {
  it("công khai quota lượt đã dùng và còn lại", () => {
    expect(
      serializePlayerTeam({
        teamId: "og-01",
        questionCount: 7,
        cooldownUntil: null,
        turnItemsUsed: 3,
        solvedCases: [],
        lastInteractionAt: 1_000,
      }),
    ).toMatchObject({
      turnItemsUsed: 3,
      turnItemsRemaining: 2,
    });
  });

  it("không lộ gmNote, confidence, model, gmId hoặc aiError", () => {
    const interaction: StoredInteraction = {
      id: "00000000-0000-4000-8000-000000000001",
      gmId: "player:og01",
      teamId: "og-01",
      submittedAt: 1_000,
      finalizedAt: 2_000,
      status: "FINALIZED",
      items: [
        {
          id: "item-1",
          caseId: "case-01",
          type: "QUESTION",
          content: "Vũng nước từng là băng đúng không?",
        },
      ],
      aiResults: [
        {
          itemId: "item-1",
          itemType: "QUESTION",
          verdict: "DUNG",
          finalCorrect: null,
          confidence: "HIGH",
          gmNote: "Ghi chú bí mật không dành cho người chơi.",
        },
      ],
      finalResults: [
        {
          itemId: "item-1",
          itemType: "QUESTION",
          verdict: "DUNG",
          finalCorrect: null,
          confidence: "HIGH",
          gmNote: "Ghi chú bí mật không dành cho người chơi.",
        },
      ],
      aiError: "Chi tiết upstream nội bộ",
      model: "internal-model-name",
      aiAttempts: 1,
      aiStartedAt: 1_000,
    };

    expect(serializePlayerResults(interaction.finalResults)).toEqual([
      {
        itemId: "item-1",
        itemType: "QUESTION",
        verdict: "DUNG",
        finalCorrect: null,
      },
    ]);

    const serialized = serializePlayerInteraction(interaction);
    const json = JSON.stringify(serialized);
    expect(serialized.status).toBe("FINALIZED");
    expect(json).not.toContain("gmNote");
    expect(json).not.toContain("confidence");
    expect(json).not.toContain("gmId");
    expect(json).not.toContain("aiError");
    expect(json).not.toContain("model");
    expect(json).not.toContain("Ghi chú bí mật");
  });

  it("đổi một AI attempt bị bỏ dở thành FAILED mà không gọi AI lần hai", () => {
    const interaction: StoredInteraction = {
      id: "00000000-0000-4000-8000-000000000002",
      gmId: "player:og01",
      teamId: "og-01",
      submittedAt: 1_000,
      finalizedAt: null,
      status: "PENDING",
      items: [
        {
          id: "item-1",
          caseId: "case-01",
          type: "QUESTION",
          content: "Đây là câu hỏi thử đúng không?",
        },
      ],
      aiResults: null,
      finalResults: null,
      aiError: null,
      model: null,
      aiAttempts: 1,
      aiStartedAt: 1_000,
    };

    expect(isStalePlayerInteraction(interaction, 40_000)).toBe(true);
    expect(serializePlayerInteraction(interaction).status).toBe("FAILED");
  });
});
