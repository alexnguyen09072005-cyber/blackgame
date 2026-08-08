import { afterEach, describe, expect, it } from "vitest";

import { COOLDOWN_MS } from "../../lib/config/game";
import type {
  AdjudicationResult,
  InteractionItem,
} from "../../lib/domain/types";
import {
  getEventStore,
  MemoryEventStore,
  resetEventStoreForTests,
} from "../../lib/server/store";

function question(itemId: string, caseId = "case-01"): InteractionItem {
  return {
    id: itemId,
    caseId,
    type: "QUESTION",
    content: "Có phải do trời mưa không?",
  };
}

function finalAnswer(itemId: string, caseId = "case-01"): InteractionItem {
  return {
    id: itemId,
    caseId,
    type: "FINAL_ANSWER",
    content: "Đây là lời giải cuối cùng.",
  };
}

function correctResult(itemId: string): AdjudicationResult {
  return {
    itemId,
    itemType: "FINAL_ANSWER",
    verdict: null,
    finalCorrect: true,
    confidence: "HIGH",
    gmNote: "Đúng",
  };
}

afterEach(() => {
  resetEventStoreForTests();
});

describe("MemoryEventStore", () => {
  it("khởi tạo đủ 12 OG và không để caller sửa state nội bộ", async () => {
    const store = new MemoryEventStore();
    const states = await store.getAllTeamStates();

    expect(states).toHaveLength(12);
    expect(states.map((state) => state.teamId)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `og-${String(index + 1).padStart(2, "0")}`,
      ),
    );

    states[0]!.questionCount = 99;
    states[0]!.solvedCases.push({
      caseId: "case-mutated",
      solvedAt: 1,
      interactionId: "outside",
    });
    expect(await store.getTeamState("og-01")).toEqual({
      teamId: "og-01",
      questionCount: 0,
      turnItemsUsed: 0,
      cooldownUntil: null,
      solvedCases: [],
      lastInteractionAt: null,
    });
  });

  it("giữ nguyên batch, chỉ tốn một slot, replay không tốn thêm và vẫn chặn case đã giải", async () => {
    const store = new MemoryEventStore();
    const items = [question("q-1"), finalAnswer("f-1")];

    const [first, replay] = await Promise.all([
      store.createInteraction({
        id: "interaction-1",
        gmId: "player:og01",
        teamId: "og-01",
        items,
        now: 10_000,
      }),
      store.createInteraction({
        id: "interaction-1",
        gmId: "player:og01",
        teamId: "og-01",
        items,
        now: 10_001,
      }),
    ]);

    expect(first.kind).toBe("CREATED");
    expect(replay.kind).toBe("EXISTING");
    expect(await store.getTeamState("og-01")).toMatchObject({
      questionCount: 1,
      turnItemsUsed: 1,
      cooldownUntil: null,
      lastInteractionAt: 10_000,
    });
    expect((await store.getInteraction("interaction-1"))?.items).toEqual(items);

    await store.markSolved("og-01", "case-02", 20_000);
    await expect(
      store.createInteraction({
        id: "interaction-3",
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-3", "case-02")],
        now: 20_001,
      }),
    ).resolves.toEqual({ kind: "CASE_SOLVED", caseId: "case-02" });
  });

  it("atomically chỉ nhận slot thứ 5 trong hai request đồng thời rồi cooldown", async () => {
    const store = new MemoryEventStore();
    const now = Date.now() + 60_000;

    for (let index = 1; index <= 4; index += 1) {
      await expect(
        store.createInteraction({
          id: `interaction-${index}`,
          gmId: "player:og01",
          teamId: "og-01",
          items: [question(`q-${index}`)],
          now: now + index,
        }),
      ).resolves.toMatchObject({ kind: "CREATED" });
    }
    expect(await store.getTeamState("og-01")).toMatchObject({
      turnItemsUsed: 4,
      cooldownUntil: null,
    });

    const fifthAt = now + 10;
    const [fifth, later] = await Promise.all([
      store.createInteraction({
        id: "interaction-5",
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-5")],
        now: fifthAt,
      }),
      store.createInteraction({
        id: "interaction-6",
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-6")],
        now: fifthAt,
      }),
    ]);

    expect(fifth).toMatchObject({ kind: "CREATED" });
    expect(later).toEqual({
      kind: "COOLDOWN",
      cooldownUntil: fifthAt + COOLDOWN_MS,
    });
    expect(await store.getTeamState("og-01")).toMatchObject({
      turnItemsUsed: 5,
      cooldownUntil: fifthAt + COOLDOWN_MS,
    });
    await expect(
      store.createInteraction({
        id: "interaction-5",
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-5")],
        now: fifthAt + 1,
      }),
    ).resolves.toMatchObject({ kind: "EXISTING" });
    await expect(store.getAllInteractions()).resolves.toHaveLength(5);

    await expect(
      store.createInteraction({
        id: "interaction-after-expiry",
        gmId: "player:og01",
        teamId: "og-01",
        items: [question("q-after")],
        now: fifthAt + COOLDOWN_MS,
      }),
    ).resolves.toMatchObject({ kind: "CREATED" });
    expect(await store.getTeamState("og-01")).toMatchObject({
      turnItemsUsed: 1,
      cooldownUntil: null,
    });
  });

  it("read tự xóa cooldown đã hết và mở turn mới", async () => {
    const store = new MemoryEventStore();
    for (let index = 1; index <= 5; index += 1) {
      await store.createInteraction({
        id: `expired-${index}`,
        gmId: "player:og01",
        teamId: "og-01",
        items: [question(`expired-q-${index}`)],
        now: index,
      });
    }

    expect(await store.getTeamState("og-01")).toMatchObject({
      questionCount: 5,
      turnItemsUsed: 0,
      cooldownUntil: null,
    });
  });

  it("chỉ cấp một AI attempt, lưu startedAt và fail lượt bị treo", async () => {
    const store = new MemoryEventStore();
    await store.createInteraction({
      id: "interaction-ai",
      gmId: "player:og01",
      teamId: "og-01",
      items: [question("q-ai")],
      now: 1_000,
    });

    await expect(store.beginAiAttempt("interaction-ai", 2_000)).resolves.toBe(1);
    await expect(store.beginAiAttempt("interaction-ai", 2_001)).resolves.toBeNull();
    await expect(
      store.failStaleAiAttempt("interaction-ai", 1_999),
    ).resolves.toBeNull();

    const failed = await store.failStaleAiAttempt("interaction-ai", 2_000);
    expect(failed).toMatchObject({
      aiAttempts: 1,
      aiStartedAt: 2_000,
      status: "PENDING",
    });
    expect(failed?.aiError).toContain("AI_STALE");
    await expect(
      store.failStaleAiAttempt("interaction-ai", 9_999),
    ).resolves.toBeNull();
  });

  it("giữ AI outcome và giới hạn tổng số call trong process", async () => {
    const store = new MemoryEventStore();
    const item = finalAnswer("f-ai");
    await store.createInteraction({
      id: "interaction-outcome",
      gmId: "player:og01",
      teamId: "og-01",
      items: [item],
      now: 1_000,
    });

    const result = correctResult(item.id);
    const saved = await store.saveAiSuccess(
      "interaction-outcome",
      [result],
      "test-model",
    );
    expect(saved).toMatchObject({
      status: "AI_COMPLETE",
      aiResults: [result],
      aiError: null,
      model: "test-model",
    });

    const [first, second, rejected] = await Promise.all([
      store.reserveAiCall(2),
      store.reserveAiCall(2),
      store.reserveAiCall(2),
    ]);
    expect([first, second, rejected]).toEqual([1, 2, null]);
    await expect(store.getAiCallCount()).resolves.toBe(2);
  });

  it("ghi nhận lần giải có submittedAt sớm nhất dù finalize muộn hơn", async () => {
    const store = new MemoryEventStore();
    const earlyItem = finalAnswer("f-early", "case-09");
    const lateItem = finalAnswer("f-late", "case-09");

    await store.createInteraction({
      id: "interaction-early",
      gmId: "player:og01",
      teamId: "og-01",
      items: [earlyItem],
      now: 1_000,
    });
    await store.resetCooldown("og-01");
    await store.createInteraction({
      id: "interaction-late",
      gmId: "player:og01",
      teamId: "og-01",
      items: [lateItem],
      now: 2_000,
    });

    await store.finalizeInteraction(
      "interaction-late",
      [correctResult(lateItem.id)],
      { now: 3_000 },
    );
    const finalizedEarly = await store.finalizeInteraction(
      "interaction-early",
      [correctResult(earlyItem.id)],
      { now: 4_000 },
    );

    expect(finalizedEarly).toMatchObject({
      status: "FINALIZED",
      finalizedAt: 4_000,
    });
    expect((await store.getTeamState("og-01")).solvedCases).toEqual([
      {
        caseId: "case-09",
        solvedAt: 1_000,
        interactionId: "interaction-early",
      },
    ]);

    const unchanged = await store.finalizeInteraction(
      "interaction-early",
      [{ ...correctResult(earlyItem.id), finalCorrect: false }],
      { now: 5_000 },
    );
    expect(unchanged?.finalizedAt).toBe(4_000);
    expect(unchanged?.finalResults?.[0]?.finalCorrect).toBe(true);
  });

  it("giữ singleton trên globalThis cho tới khi reset test", async () => {
    const first = getEventStore();
    await first.setQuestionCount("og-12", 7);

    const second = getEventStore();
    expect(second).toBe(first);
    expect((await second.getTeamState("og-12")).questionCount).toBe(7);

    resetEventStoreForTests();
    const fresh = getEventStore();
    expect(fresh).not.toBe(first);
    expect((await fresh.getTeamState("og-12")).questionCount).toBe(0);
  });
});
