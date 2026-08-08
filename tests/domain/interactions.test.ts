import { describe, expect, it } from "vitest";

import {
  countQuestionItems,
  createEmptyTeamState,
  getCooldownStatus,
  planInteractionSubmission,
  recordSolvedCasesFromResults,
} from "../../lib/domain/interactions";
import type {
  AdjudicationResult,
  InteractionItem,
} from "../../lib/domain/types";

const interactionId = "00000000-0000-4000-8000-000000000001";
const submittedAt = 1_000_000;
const items: InteractionItem[] = [
  {
    id: "item-1",
    caseId: "case-01",
    type: "QUESTION",
    content: "Câu hỏi một?",
  },
  {
    id: "item-2",
    caseId: "case-02",
    type: "FINAL_ANSWER",
    content: "Đáp án cuối.",
  },
  {
    id: "item-3",
    caseId: "case-02",
    type: "QUESTION",
    content: "Câu hỏi hai?",
  },
];

describe("state transition của interaction", () => {
  it("chỉ đếm QUESTION, không đếm FINAL_ANSWER", () => {
    expect(countQuestionItems(items)).toBe(2);

    const plan = planInteractionSubmission({
      interactionId,
      gmId: "gm-1",
      teamId: "og-01",
      items,
      submittedAt,
      teamState: createEmptyTeamState("og-01"),
    });

    expect(plan.kind).toBe("CREATE");
    if (plan.kind === "CREATE") {
      expect(plan.nextTeamState.questionCount).toBe(2);
      expect(plan.nextTeamState.turnItemsUsed).toBe(1);
      expect(plan.nextTeamState.cooldownUntil).toBeNull();
      expect(plan.interaction.items).toEqual(items);
    }
  });

  it("chỉ cooldown toàn OG sau slot thứ 5 và reset quota khi hết hạn", () => {
    let state = createEmptyTeamState("og-01");
    let fifthSubmittedAt = submittedAt;

    for (let index = 1; index <= 5; index += 1) {
      fifthSubmittedAt = submittedAt + index * 1_000;
      const plan = planInteractionSubmission({
        interactionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        gmId: "gm-1",
        teamId: "og-01",
        items: [items[index % items.length]!],
        submittedAt: fifthSubmittedAt,
        teamState: state,
      });
      expect(plan.kind).toBe("CREATE");
      if (plan.kind !== "CREATE") return;
      state = plan.nextTeamState;
      expect(state.turnItemsUsed).toBe(index);
      expect(state.cooldownUntil).toBe(
        index === 5 ? fifthSubmittedAt + 300_000 : null,
      );
    }

    const blocked = planInteractionSubmission({
      interactionId: "00000000-0000-4000-8000-000000000006",
      gmId: "gm-1",
      teamId: "og-01",
      items: [items[0]!],
      submittedAt: fifthSubmittedAt + 127_000,
      teamState: state,
    });
    expect(blocked).toEqual({
      kind: "COOLDOWN",
      retryAfterSeconds: 173,
      cooldownUntil: fifthSubmittedAt + 300_000,
    });
    expect(
      getCooldownStatus(state, fifthSubmittedAt + 300_000),
    ).toEqual({ active: false, retryAfterSeconds: 0 });

    const nextTurn = planInteractionSubmission({
      interactionId: "00000000-0000-4000-8000-000000000007",
      gmId: "gm-1",
      teamId: "og-01",
      items: [items[0]!],
      submittedAt: fifthSubmittedAt + 300_000,
      teamState: state,
    });
    expect(nextTurn.kind).toBe("CREATE");
    if (nextTurn.kind === "CREATE") {
      expect(nextTurn.nextTeamState.turnItemsUsed).toBe(1);
      expect(nextTurn.nextTeamState.cooldownUntil).toBeNull();
    }
  });

  it("retry cùng interactionId là idempotent, không đếm hoặc cooldown lần hai", () => {
    const firstPlan = planInteractionSubmission({
      interactionId,
      gmId: "gm-1",
      teamId: "og-01",
      items,
      submittedAt,
      teamState: createEmptyTeamState("og-01"),
    });
    expect(firstPlan.kind).toBe("CREATE");
    if (firstPlan.kind !== "CREATE") return;

    const retryPlan = planInteractionSubmission({
      interactionId,
      gmId: "gm-1",
      teamId: "og-01",
      items,
      submittedAt: submittedAt + 10_000,
      teamState: firstPlan.nextTeamState,
      existingInteraction: firstPlan.interaction,
    });

    expect(retryPlan.kind).toBe("IDEMPOTENT_REPLAY");
    if (retryPlan.kind === "IDEMPOTENT_REPLAY") {
      expect(retryPlan.nextTeamState).toBe(firstPlan.nextTeamState);
      expect(retryPlan.nextTeamState.questionCount).toBe(2);
      expect(retryPlan.nextTeamState.turnItemsUsed).toBe(1);
      expect(retryPlan.nextTeamState.cooldownUntil).toBeNull();
    }
  });

  it("một OG không solve cùng case hai lần", () => {
    const plan = planInteractionSubmission({
      interactionId,
      gmId: "gm-1",
      teamId: "og-01",
      items: [
        items[1]!,
        { ...items[1]!, id: "item-duplicate", content: "Cách nói khác." },
      ],
      submittedAt,
      teamState: createEmptyTeamState("og-01"),
    });
    expect(plan.kind).toBe("CREATE");
    if (plan.kind !== "CREATE") return;

    const results: AdjudicationResult[] = [
      {
        itemId: "item-2",
        itemType: "FINAL_ANSWER",
        verdict: null,
        finalCorrect: true,
        confidence: "HIGH",
        gmNote: "Đúng.",
      },
      {
        itemId: "item-duplicate",
        itemType: "FINAL_ANSWER",
        verdict: null,
        finalCorrect: true,
        confidence: "HIGH",
        gmNote: "Cũng đúng.",
      },
    ];

    const once = recordSolvedCasesFromResults(
      plan.nextTeamState,
      plan.interaction,
      results,
    );
    const twice = recordSolvedCasesFromResults(
      once,
      plan.interaction,
      results,
    );

    expect(once.solvedCases).toEqual([
      { caseId: "case-02", solvedAt: submittedAt, interactionId },
    ]);
    expect(twice.solvedCases).toHaveLength(1);
  });
});
