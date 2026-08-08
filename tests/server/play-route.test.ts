import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdjudicationResult,
  InteractionItem,
  TeamState,
} from "../../lib/domain/types";
import type { StoredInteraction } from "../../lib/server/store";

const mocks = vi.hoisted(() => ({
  adjudicateItems: vi.fn(),
  buildAdjudicationPayload: vi.fn(),
  getEventStore: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/server/ai", () => ({
  AiAdjudicationError: class AiAdjudicationError extends Error {},
  adjudicateItems: mocks.adjudicateItems,
  buildAdjudicationPayload: mocks.buildAdjudicationPayload,
}));

vi.mock("@/lib/server/store", () => ({
  getEventStore: mocks.getEventStore,
}));

import { POST } from "../../app/api/play/route";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

const question: InteractionItem = {
  id: "item-question",
  caseId: "case-01",
  type: "QUESTION",
  content: "Người này có ở trong phòng không?",
};

const finalAnswer: InteractionItem = {
  id: "item-answer",
  caseId: "case-01",
  type: "FINAL_ANSWER",
  content: "Đây là lời giải cuối cùng.",
};

function playRequest(items: InteractionItem[]): Request {
  return new Request("https://example.test/api/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      interactionId: "00000000-0000-4000-8000-000000000001",
      items,
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.OPENAI_API_KEY = "test-openai-key";
  mocks.requireSession.mockResolvedValue({
    role: "PLAYER",
    teamId: "og-01",
    username: "og01",
  });
});

afterAll(() => {
  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  }
});

describe("POST /api/play", () => {
  it.each([
    ["không có item", []],
    ["có nhiều item", [question, finalAnswer]],
  ])("từ chối khi %s", async (_label, items) => {
    const response = await POST(playRequest(items));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "VALIDATION_ERROR",
      fields: [
        {
          path: "items",
          message: "Mỗi lần gửi phải có đúng một nội dung.",
        },
      ],
    });
    expect(mocks.getEventStore).not.toHaveBeenCalled();
    expect(mocks.adjudicateItems).not.toHaveBeenCalled();
  });

  it("chấm đúng một item bằng đúng một AI call", async () => {
    const result: AdjudicationResult = {
      itemId: question.id,
      itemType: "QUESTION",
      verdict: "DUNG",
      finalCorrect: null,
      confidence: "HIGH",
      gmNote: "Đúng",
    };
    const pending: StoredInteraction = {
      id: "00000000-0000-4000-8000-000000000001",
      gmId: "player:og01",
      teamId: "og-01",
      submittedAt: 1_000,
      finalizedAt: null,
      status: "PENDING",
      items: [question],
      aiResults: null,
      finalResults: null,
      aiError: null,
      model: null,
      aiAttempts: 0,
      aiStartedAt: null,
    };
    const withAi: StoredInteraction = {
      ...pending,
      status: "AI_COMPLETE",
      aiResults: [result],
      model: "test-model",
      aiAttempts: 1,
      aiStartedAt: 1_001,
    };
    const finalized: StoredInteraction = {
      ...withAi,
      status: "FINALIZED",
      finalizedAt: 1_002,
      finalResults: [result],
    };
    const teamState: TeamState = {
      teamId: "og-01",
      questionCount: 0,
      cooldownUntil: null,
      solvedCases: [],
      lastInteractionAt: null,
      turnItemsUsed: 0,
    };
    const store = {
      getInteraction: vi.fn().mockResolvedValue(null),
      getTeamState: vi.fn().mockResolvedValue(teamState),
      createInteraction: vi.fn().mockResolvedValue({
        kind: "CREATED",
        value: { interaction: pending, duplicate: false },
      }),
      beginAiAttempt: vi.fn().mockResolvedValue(1),
      reserveAiCall: vi.fn().mockResolvedValue(1),
      saveAiError: vi.fn(),
      saveAiSuccess: vi.fn().mockResolvedValue(withAi),
      finalizeInteraction: vi.fn().mockResolvedValue(finalized),
    };
    mocks.getEventStore.mockReturnValue(store);
    mocks.adjudicateItems.mockResolvedValue({
      results: [result],
      model: "test-model",
    });

    const response = await POST(playRequest([question]));

    expect(response.status).toBe(201);
    expect(mocks.adjudicateItems).toHaveBeenCalledOnce();
    expect(mocks.adjudicateItems).toHaveBeenCalledWith([question]);
    expect(store.createInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "og-01",
        items: [question],
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: {
        duplicate: false,
        results: [
          {
            itemId: question.id,
            itemType: "QUESTION",
            verdict: "DUNG",
            finalCorrect: null,
          },
        ],
      },
    });
  });
});
