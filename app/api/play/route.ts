import {
  serializePlayerInteraction,
  serializePlayerResults,
  serializePlayerTeam,
  effectivePlayerCases,
  isStalePlayerInteraction,
} from "@/app/api/player/_shared";
import { AI_PENDING_STALE_MS } from "@/lib/config/game";
import { interactionItemSchema } from "@/lib/domain/schemas";
import type { InteractionItem } from "@/lib/domain/types";
import {
  AiAdjudicationError,
  adjudicateItems,
  buildAdjudicationPayload,
} from "@/lib/server/ai";
import { requireSession } from "@/lib/server/auth";
import { HAS_GAME_RULES } from "@/lib/server/cases";
import { ApiError, jsonOk, readJson, withApiErrors } from "@/lib/server/http";
import {
  getEventStore,
  type EventStore,
  type StoredInteraction,
} from "@/lib/server/store";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const playSchema = z
  .object({
    interactionId: z.string().uuid("Mã lượt không hợp lệ."),
    items: z
      .array(interactionItemSchema)
      .length(1, "Mỗi lần gửi phải có đúng một nội dung."),
  })
  .strict()
  .superRefine((submission, context) => {
    const itemIds = new Set<string>();
    const caseIds = new Set<string>();
    submission.items.forEach((item, index) => {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Mỗi nội dung phải có mã riêng.",
        });
      }
      itemIds.add(item.id);
      caseIds.add(item.caseId);
    });
    if (caseIds.size > 1) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Mỗi lượt chỉ được chọn một vụ án.",
      });
    }
  });

function maxAiCalls(): number {
  const configured = Number.parseInt(process.env.MAX_AI_CALLS ?? "500", 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : 500;
}

function sameItems(
  stored: readonly InteractionItem[],
  requested: readonly InteractionItem[],
): boolean {
  return JSON.stringify(stored) === JSON.stringify(requested);
}

function recordedAiError(
  interactionId: string,
  status = 502,
  code = "AI_UNAVAILABLE",
): ApiError {
  return new ApiError(
    status,
    code,
    "Không thể chấm nội dung này lúc này. Nội dung và quota của OG vẫn đã được ghi nhận.",
    { interactionId, recorded: true },
  );
}

async function finalizeSavedResults(
  store: EventStore,
  interaction: StoredInteraction,
): Promise<StoredInteraction | null> {
  if (!interaction.aiResults) {
    return null;
  }
  return store.finalizeInteraction(interaction.id, interaction.aiResults);
}

async function playerPlayResponse(
  store: EventStore,
  interaction: StoredInteraction,
  duplicate: boolean,
  status = 200,
): Promise<Response> {
  const team = serializePlayerTeam(
    await store.getTeamState(interaction.teamId),
  );
  return jsonOk(
    {
      team,
      interaction: serializePlayerInteraction(interaction),
      results: serializePlayerResults(
        interaction.finalResults ?? interaction.aiResults,
      ),
      duplicate,
    },
    status,
  );
}

async function adjudicateAndFinalize(
  store: EventStore,
  interaction: StoredInteraction,
): Promise<StoredInteraction | null> {
  const claimed = await store.beginAiAttempt(interaction.id);
  if (!claimed) {
    const latest = await store.getInteraction(interaction.id);
    if (latest?.status === "FINALIZED") {
      return latest;
    }
    if (latest?.aiResults) {
      return finalizeSavedResults(store, latest);
    }
    return null;
  }

  if ((await store.reserveAiCall(maxAiCalls())) === null) {
    await store.saveAiError(
      interaction.id,
      "AI_LIMIT: Đã đạt giới hạn lượt gọi AI.",
    );
    throw recordedAiError(interaction.id, 503, "AI_LIMIT_REACHED");
  }

  let adjudication: Awaited<ReturnType<typeof adjudicateItems>>;
  try {
    adjudication = await adjudicateItems(interaction.items);
  } catch (error) {
    const safeError =
      error instanceof AiAdjudicationError
        ? `${error.code}: ${error.message}`
        : "UPSTREAM_ERROR: Không thể kết nối với AI.";
    await store.saveAiError(interaction.id, safeError);
    throw recordedAiError(interaction.id);
  }

  // Keep persistence outside the upstream catch. If saving fails after a valid
  // model response, a replay can recover saved results instead of erasing them.
  const withAi = await store.saveAiSuccess(
    interaction.id,
    adjudication.results,
    adjudication.model,
  );
  if (!withAi) {
    return null;
  }
  return store.finalizeInteraction(interaction.id, adjudication.results);
}

async function existingResponse(
  store: EventStore,
  interaction: StoredInteraction,
  teamId: string,
  items: InteractionItem[],
): Promise<Response> {
  if (interaction.teamId !== teamId || !sameItems(interaction.items, items)) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "Mã lượt này đã được dùng cho dữ liệu khác.",
    );
  }
  if (interaction.status === "FINALIZED") {
    return playerPlayResponse(store, interaction, true);
  }
  if (interaction.aiResults) {
    const finalized = await finalizeSavedResults(store, interaction);
    if (!finalized) {
      throw new ApiError(500, "FINALIZE_FAILED", "Không thể hoàn tất lượt chơi.");
    }
    return playerPlayResponse(store, finalized, true);
  }
  if (interaction.aiError) {
    throw recordedAiError(interaction.id);
  }
  if (isStalePlayerInteraction(interaction)) {
    const failed = await store.failStaleAiAttempt(
      interaction.id,
      Date.now() - AI_PENDING_STALE_MS,
    );
    if (failed?.aiError) {
      throw recordedAiError(interaction.id);
    }
    const latest = await store.getInteraction(interaction.id);
    if (latest?.status === "FINALIZED") {
      return existingResponse(store, latest, teamId, items);
    }
    if (latest?.aiResults) {
      const finalized = await finalizeSavedResults(store, latest);
      if (finalized) {
        return playerPlayResponse(store, finalized, true);
      }
    }
    if (latest?.aiError) {
      throw recordedAiError(interaction.id);
    }
  }
  if (interaction.aiAttempts === 0) {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new ApiError(
        503,
        "OPENAI_NOT_CONFIGURED",
        "Hệ thống chấm điểm chưa được cấu hình.",
      );
    }
    const finalized = await adjudicateAndFinalize(store, interaction);
    if (finalized) {
      return playerPlayResponse(store, finalized, true);
    }
  }
  // Another identical request owns the one AI call. The client can refresh
  // player state without creating or charging a second interaction.
  const latest = (await store.getInteraction(interaction.id)) ?? interaction;
  return playerPlayResponse(store, latest, true, 202);
}

export const POST = withApiErrors(async (request: Request) => {
  const principal = await requireSession();
  const submission = await readJson(request, playSchema);
  const store = getEventStore();

  // An exact replay is resolved before mutable solved/enabled/cooldown checks.
  const replay = await store.getInteraction(submission.interactionId);
  if (replay) {
    return existingResponse(
      store,
      replay,
      principal.teamId,
      submission.items,
    );
  }

  // Setup failures must not consume a shared OG slot.
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new ApiError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "Hệ thống chấm điểm chưa được cấu hình.",
    );
  }
  if (!HAS_GAME_RULES) {
    throw new ApiError(
      503,
      "GAME_NOT_CONFIGURED",
      "Dữ liệu vụ án chưa sẵn sàng.",
    );
  }

  const [teamState, cases] = await Promise.all([
    store.getTeamState(principal.teamId),
    effectivePlayerCases(),
  ]);
  const caseById = new Map(cases.map((caseDefinition) => [caseDefinition.id, caseDefinition]));
  for (const item of submission.items) {
    const caseDefinition = caseById.get(item.caseId);
    if (!caseDefinition) {
      throw new ApiError(404, "CASE_NOT_FOUND", "Không tìm thấy vụ án.");
    }
    if (!caseDefinition.enabled) {
      throw new ApiError(409, "CASE_DISABLED", "Vụ án này chưa được mở.");
    }
    if (teamState.solvedCases.some((solved) => solved.caseId === item.caseId)) {
      throw new ApiError(409, "CASE_ALREADY_SOLVED", "OG đã giải vụ án này.");
    }
  }

  try {
    // Validate complete secret context before the atomic state transition.
    buildAdjudicationPayload(submission.items);
  } catch (error) {
    if (error instanceof AiAdjudicationError) {
      throw new ApiError(
        503,
        "GAME_NOT_CONFIGURED",
        "Dữ liệu vụ án chưa sẵn sàng.",
      );
    }
    throw error;
  }

  const creation = await store.createInteraction({
    id: submission.interactionId,
    gmId: `player:${principal.username}`,
    teamId: principal.teamId,
    items: submission.items,
  });
  if (creation.kind === "COOLDOWN") {
    throw new ApiError(429, "COOLDOWN", "OG đang trong thời gian chờ.", {
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((creation.cooldownUntil - Date.now()) / 1_000),
      ),
      cooldownUntil: creation.cooldownUntil,
    });
  }
  if (creation.kind === "CASE_SOLVED") {
    throw new ApiError(409, "CASE_ALREADY_SOLVED", "OG đã giải vụ án này.");
  }
  if (creation.kind === "EXISTING") {
    return existingResponse(
      store,
      creation.value.interaction,
      principal.teamId,
      submission.items,
    );
  }

  const finalized = await adjudicateAndFinalize(
    store,
    creation.value.interaction,
  );
  if (!finalized) {
    const latest =
      (await store.getInteraction(creation.value.interaction.id)) ??
      creation.value.interaction;
    if (latest.aiError) {
      throw recordedAiError(latest.id);
    }
    return playerPlayResponse(store, latest, false, 202);
  }
  return playerPlayResponse(store, finalized, false, 201);
});
