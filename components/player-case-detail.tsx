"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, fetchJson, formatDateTime, getErrorMessage } from "./client-api";
import { CooldownStatus, useRemainingSeconds } from "./countdown";
import type {
  InteractionItem,
  InteractionItemType,
  PublicCase,
  QuestionVerdict,
  TeamSummary,
} from "./game-types";
import { VERDICT_LABELS } from "./game-types";
import { PlayerHeader } from "./player-header";
import {
  Button,
  EmptyState,
  ErrorNotice,
  FieldLabel,
  InfoNotice,
  LoadingBlock,
  PageShell,
  SectionHeading,
  StatusPill,
  Surface,
  cn,
  inputClass,
} from "./ui";

type PlayerUser = {
  role: "player";
  teamId: string;
  username: string;
  name: string;
};

type SessionResponse = { data: { user: PlayerUser | { role: string } | null } };

type PlayerResult = {
  itemId: string;
  itemType: InteractionItemType;
  verdict: QuestionVerdict | null;
  finalCorrect: boolean | null;
};

type PlayerInteraction = {
  id: string;
  teamId: string;
  submittedAt: number;
  finalizedAt: number | null;
  status: "PENDING" | "FINALIZED" | "FAILED";
  items: InteractionItem[];
  results: PlayerResult[] | null;
};

type PlayerStateData = {
  team: TeamSummary;
  cases: PublicCase[];
  interactions: PlayerInteraction[];
};

type PlayerStateResponse = { data: PlayerStateData };

type PlayResponse = {
  data: {
    team: TeamSummary;
    interaction: PlayerInteraction;
    results: PlayerResult[] | null;
    duplicate: boolean;
  };
};

type HistoryEntry = {
  interaction: PlayerInteraction;
  item: InteractionItem;
  result: PlayerResult | null;
};

const QUESTION_MAX_LENGTH = 300;
const FINAL_ANSWER_MAX_LENGTH = 1_000;
const TURN_ITEM_LIMIT = 5;
const STATE_POLL_MS = 3_000;

function resultLabel(result: PlayerResult | null, status: PlayerInteraction["status"]): string {
  if (status === "PENDING") return "Đang chấm";
  if (status === "FAILED") return "Chưa có kết quả";
  if (!result) return "Chưa có kết quả";
  if (result.itemType === "QUESTION") {
    return result.verdict ? VERDICT_LABELS[result.verdict] : "Chưa có kết quả";
  }
  if (result.finalCorrect === true) return "Chính xác";
  if (result.finalCorrect === false) return "Chưa chính xác";
  return "Chưa có kết quả";
}

function resultTone(
  result: PlayerResult | null,
  status: PlayerInteraction["status"],
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "PENDING") return "warning";
  if (status === "FAILED" || !result) return "danger";
  if (result.itemType === "FINAL_ANSWER") return result.finalCorrect ? "success" : "danger";
  if (result.verdict === "DUNG") return "success";
  if (result.verdict === "SAI") return "danger";
  return "info";
}

function quotaValues(team: TeamSummary | null) {
  const used = Math.min(TURN_ITEM_LIMIT, Math.max(0, team?.turnItemsUsed ?? 0));
  const remaining = Math.min(
    TURN_ITEM_LIMIT,
    Math.max(0, team?.turnItemsRemaining ?? TURN_ITEM_LIMIT - used),
  );
  return { used, remaining };
}

export function PlayerCaseDetail() {
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  const [user, setUser] = useState<PlayerUser | null>(null);
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [caseItem, setCaseItem] = useState<PublicCase | null>(null);
  const [interactions, setInteractions] = useState<PlayerInteraction[]>([]);
  const [itemType, setItemType] = useState<InteractionItemType>("QUESTION");
  const [content, setContent] = useState("");
  const [pendingInteractionId, setPendingInteractionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const interactionIdRef = useRef<string | null>(null);
  const itemIdRef = useRef<string | null>(null);
  const pendingInteractionIdRef = useRef<string | null>(null);
  const previousCooldownRemainingRef = useRef(0);
  const cooldownRemaining = useRemainingSeconds(team?.cooldownUntil);

  const loadState = useCallback(async (quiet = false): Promise<PlayerStateData | null> => {
    if (!quiet) {
      setLoading(true);
      setLoadError("");
    }

    try {
      const state = await fetchJson<PlayerStateResponse>("/api/player/state");
      setTeam(state.data.team);
      setCaseItem(state.data.cases.find((candidate) => candidate.id === caseId) || null);
      setInteractions(Array.isArray(state.data.interactions) ? state.data.interactions : []);
      setSyncWarning("");

      const pendingId = pendingInteractionIdRef.current;
      if (pendingId) {
        const pending = state.data.interactions.find((interaction) => interaction.id === pendingId);
        if (pending && pending.status !== "PENDING") {
          pendingInteractionIdRef.current = null;
          setPendingInteractionId(null);
          interactionIdRef.current = null;
          itemIdRef.current = null;
          setContent("");

          if (pending.status === "FINALIZED") {
            const result = pending.results?.[0] || null;
            const quota = quotaValues(state.data.team);
            const cooldownActive = Boolean(
              state.data.team.cooldownUntil && state.data.team.cooldownUntil > Date.now(),
            );
            setNotice(
              quota.remaining === 0 || cooldownActive
                ? `${resultLabel(result, pending.status)}. Đã dùng đủ ${TURN_ITEM_LIMIT}/${TURN_ITEM_LIMIT}; OG bắt đầu thời gian chờ.`
                : `${resultLabel(result, pending.status)}. Còn ${quota.remaining} nội dung trong lượt hiện tại.`,
            );
          } else {
            setFormError("Nội dung đã được ghi nhận nhưng AI chưa trả được kết quả. Lịch sử của OG đã được cập nhật.");
          }
        }
      }

      return state.data;
    } catch (stateError) {
      if (stateError instanceof ApiError && stateError.status === 401) {
        router.replace("/dang-nhap");
        return null;
      }

      const message =
        stateError instanceof ApiError &&
        (stateError.status === 404 || stateError.status === 501 || stateError.status === 503)
          ? "Không thể tải dữ liệu vụ án. Vui lòng báo Ban tổ chức kiểm tra dịch vụ."
          : getErrorMessage(stateError);
      if (quiet) setSyncWarning("Tạm thời chưa đồng bộ được hoạt động mới của OG. Hệ thống sẽ tự thử lại.");
      else setLoadError(message);
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [caseId, router]);

  useEffect(() => {
    const previousRemaining = previousCooldownRemainingRef.current;
    previousCooldownRemainingRef.current = cooldownRemaining;
    if (previousRemaining > 0 && cooldownRemaining === 0) {
      void loadState(true);
    }
  }, [cooldownRemaining, loadState]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setLoadError("");
      try {
        const session = await fetchJson<SessionResponse>("/api/auth/session");
        if (!session.data.user || session.data.user.role !== "player") {
          router.replace("/dang-nhap");
          return;
        }
        if (cancelled) return;
        setUser(session.data.user as PlayerUser);
        await loadState(false);
      } catch (sessionError) {
        if (sessionError instanceof ApiError && sessionError.status === 401) {
          router.replace("/dang-nhap");
          return;
        }
        if (!cancelled) {
          setLoadError(
            sessionError instanceof ApiError &&
              (sessionError.status === 404 || sessionError.status === 501 || sessionError.status === 503)
              ? "Hệ thống người chơi chưa được cấu hình. Vui lòng báo Ban tổ chức."
              : getErrorMessage(sessionError),
          );
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadState, router]);

  useEffect(() => {
    if (!user) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadState(true);
    };
    const timer = window.setInterval(refreshWhenVisible, STATE_POLL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadState, user]);

  const history = useMemo<HistoryEntry[]>(() => {
    return interactions
      .flatMap((interaction) =>
        interaction.items
          .filter((item) => item.caseId === caseId)
          .map((item) => ({
            interaction,
            item,
            result: interaction.results?.find((result) => result.itemId === item.id) || null,
          })),
      )
      .sort((left, right) => right.interaction.submittedAt - left.interaction.submittedAt)
      .slice(0, 12);
  }, [caseId, interactions]);

  const solved = Boolean(team?.solvedCases?.some((item) => item.caseId === caseId));
  const quota = quotaValues(team);
  const maxLength = itemType === "QUESTION" ? QUESTION_MAX_LENGTH : FINAL_ANSWER_MAX_LENGTH;
  const formLocked = Boolean(
    submitting ||
      pendingInteractionId ||
      solved ||
      !caseItem?.enabled ||
      cooldownRemaining > 0 ||
      quota.remaining === 0,
  );

  function invalidateRequest() {
    interactionIdRef.current = null;
    itemIdRef.current = null;
    setFormError("");
    setNotice("");
  }

  function changeType(nextType: InteractionItemType) {
    setItemType(nextType);
    setContent((current) =>
      current.slice(0, nextType === "QUESTION" ? QUESTION_MAX_LENGTH : FINAL_ANSWER_MAX_LENGTH),
    );
    invalidateRequest();
  }

  function changeContent(nextContent: string) {
    setContent(nextContent);
    invalidateRequest();
  }

  function hydratePlayResponse(response: PlayResponse["data"]) {
    setTeam(response.team);
    setInteractions((current) =>
      [
        response.interaction,
        ...current.filter(
          (interaction) => interaction.id !== response.interaction.id,
        ),
      ].sort(
        (left, right) =>
          right.submittedAt - left.submittedAt || left.id.localeCompare(right.id),
      ),
    );
    setSyncWarning("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseItem) return;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setFormError(itemType === "QUESTION" ? "Câu hỏi không được để trống." : "Đáp án không được để trống.");
      return;
    }
    if (trimmedContent.length > maxLength) {
      setFormError(itemType === "QUESTION" ? "Câu hỏi quá dài." : "Đáp án quá dài.");
      return;
    }
    if (cooldownRemaining > 0 || quota.remaining === 0) {
      setFormError("OG đã dùng đủ lượt và đang trong thời gian chờ.");
      return;
    }

    const interactionId = interactionIdRef.current || crypto.randomUUID();
    const itemId = itemIdRef.current || crypto.randomUUID();
    interactionIdRef.current = interactionId;
    itemIdRef.current = itemId;
    setSubmitting(true);
    setFormError("");
    setNotice("");

    try {
      const response = await fetchJson<PlayResponse>("/api/play", {
        method: "POST",
        body: JSON.stringify({
          interactionId,
          items: [{ id: itemId, caseId: caseItem.id, type: itemType, content: trimmedContent }],
        }),
      });

      hydratePlayResponse(response.data);

      if (response.data.interaction.status === "PENDING") {
        pendingInteractionIdRef.current = interactionId;
        setPendingInteractionId(interactionId);
        setNotice("Nội dung đã được ghi nhận và đang chờ AI chấm. Trang sẽ tự cập nhật kết quả.");
        return;
      }

      const freshQuota = quotaValues(response.data.team);
      const cooldownActive = Boolean(
        response.data.team.cooldownUntil &&
          response.data.team.cooldownUntil > Date.now(),
      );
      const result = response.data.results?.[0] || response.data.interaction.results?.[0] || null;

      interactionIdRef.current = null;
      itemIdRef.current = null;
      setContent("");
      setNotice(
        freshQuota.remaining === 0 || cooldownActive
          ? `${resultLabel(result, response.data.interaction.status)}. Đã dùng đủ ${TURN_ITEM_LIMIT}/${TURN_ITEM_LIMIT}; OG bắt đầu thời gian chờ.`
          : response.data.duplicate
            ? `${resultLabel(result, response.data.interaction.status)}. Nội dung này đã được ghi nhận trước đó.`
            : `${resultLabel(result, response.data.interaction.status)}. Còn ${freshQuota.remaining} nội dung trong lượt hiện tại.`,
      );
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        router.replace("/dang-nhap");
        return;
      }
      if (submitError instanceof ApiError && submitError.status === 429) {
        await loadState(true);
        setFormError(submitError.message || "OG đang trong thời gian chờ.");
      } else if (submitError instanceof ApiError && submitError.code === "OPENAI_NOT_CONFIGURED") {
        setFormError(
          "Hệ thống chấm điểm chưa có OPENAI_API_KEY. Nội dung chưa được ghi nhận và vẫn được giữ để gửi lại sau.",
        );
      } else if (
        submitError instanceof ApiError &&
        (submitError.recorded || submitError.status === 502 || submitError.code === "AI_LIMIT_REACHED")
      ) {
        await loadState(true);
        interactionIdRef.current = null;
        itemIdRef.current = null;
        setContent("");
        setFormError(
          "Nội dung đã được ghi nhận nhưng AI chưa thể trả kết quả. Lịch sử và lượt dùng chung của OG đã được cập nhật.",
        );
      } else if (
        submitError instanceof ApiError &&
        (submitError.status === 503 || submitError.code?.includes("AI_"))
      ) {
        setFormError("Hệ thống chấm điểm chưa sẵn sàng. Nội dung vẫn được giữ để bạn thử lại sau.");
      } else {
        setFormError(`${getErrorMessage(submitError)} Bạn có thể gửi lại an toàn với cùng mã nội dung.`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !caseItem) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><LoadingBlock label="Đang mở vụ án…" /></div>
      </PageShell>
    );
  }

  if (loadError && !caseItem) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
          <ErrorNotice message={loadError} />
          <Button variant="secondary" className="mt-4 w-full" onClick={() => void loadState(false)}>Thử tải lại</Button>
          <Button className="mt-3 w-full" onClick={() => router.replace("/vu-an")}>Về danh sách vụ án</Button>
        </div>
      </PageShell>
    );
  }

  if (!caseItem) {
    return (
      <PageShell>
        <PlayerHeader playerName={user?.name} backHref="/vu-an" />
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <EmptyState title="Không tìm thấy vụ án" detail="Danh sách chính thức hiện có đúng 9 vụ án từ 01 đến 09." />
          <Button className="mt-4 w-full" onClick={() => router.replace("/vu-an")}>Về danh sách vụ án</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PlayerHeader playerName={team?.name || user?.name} backHref="/vu-an" />
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <SectionHeading
          eyebrow={`Hồ sơ ${String(caseItem.number).padStart(2, "0")}`}
          title={caseItem.title}
          detail={`Độ khó: ${caseItem.difficulty}`}
          action={
            solved ? (
              <StatusPill tone="success">Đã giải</StatusPill>
            ) : !caseItem.enabled ? (
              <StatusPill tone="warning">Tạm khóa</StatusPill>
            ) : null
          }
        />

        <Surface className="mt-6 overflow-hidden">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-amber-300/75">Đề bài công khai</p>
          </div>
          <div className="p-5 sm:p-7">
            <p className="whitespace-pre-wrap text-lg font-semibold leading-8 text-stone-200">{caseItem.publicStory}</p>
          </div>
        </Surface>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
          <Surface className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-amber-300/75">Lượt suy luận dùng chung</p>
                <h2 className="mt-1 text-2xl font-black text-white">Gửi một nội dung</h2>
                <p className="mt-2 text-sm leading-6 text-stone-400">Mỗi lần gửi một câu hỏi hoặc một đáp án để mọi thành viên OG cùng theo dõi.</p>
              </div>
              <StatusPill tone={quota.remaining > 0 ? "info" : "warning"}>{quota.used}/{TURN_ITEM_LIMIT} đã dùng</StatusPill>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-stone-200">Còn {quota.remaining} nội dung trước thời gian chờ</span>
                <span className="font-mono text-xs text-stone-500">{quota.used}/{TURN_ITEM_LIMIT}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-amber-300 transition-[width] duration-300"
                  style={{ width: `${(quota.used / TURN_ITEM_LIMIT) * 100}%` }}
                />
              </div>
            </div>

            {cooldownRemaining > 0 ? (
              <div className="mt-5 space-y-3">
                <InfoNotice>OG đã dùng đủ lượt. Bạn có thể chuẩn bị nội dung và gửi khi đồng hồ kết thúc.</InfoNotice>
                <div className="flex justify-center sm:justify-start">
                  <CooldownStatus cooldownUntil={team?.cooldownUntil} />
                </div>
              </div>
            ) : null}
            {pendingInteractionId ? (
              <div className="mt-5"><InfoNotice>Một nội dung từ thiết bị này đang được chấm. Kết quả sẽ tự xuất hiện trong lịch sử.</InfoNotice></div>
            ) : null}
            {!caseItem.enabled ? (
              <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-sm leading-6 text-amber-100">
                Vụ án này đang tạm khóa. Bạn có thể đọc đề bài nhưng chưa thể gửi nội dung mới.
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <fieldset disabled={formLocked}>
                <legend className="mb-2 text-sm font-semibold text-stone-200">Loại nội dung</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["QUESTION", "FINAL_ANSWER"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={formLocked}
                      aria-pressed={itemType === type}
                      onClick={() => changeType(type)}
                      className={cn(
                        "min-h-12 rounded-xl border px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50",
                        itemType === type
                          ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                          : "border-white/10 bg-white/[0.035] text-stone-400",
                      )}
                    >
                      {type === "QUESTION" ? "Câu hỏi Có / Không" : "Đáp án cuối"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <div className="flex items-end justify-between gap-3">
                  <FieldLabel htmlFor="player-content">
                    {itemType === "QUESTION" ? "Câu hỏi của OG" : "Suy luận cuối cùng"}
                  </FieldLabel>
                  <span className={cn("mb-2 text-xs tabular-nums", content.length > maxLength * 0.9 ? "text-amber-300" : "text-stone-500")}>
                    {content.length}/{maxLength}
                  </span>
                </div>
                <textarea
                  id="player-content"
                  rows={itemType === "QUESTION" ? 4 : 7}
                  maxLength={maxLength}
                  value={content}
                  onChange={(event) => changeContent(event.target.value)}
                  className={cn(inputClass, "resize-y leading-7")}
                  placeholder={itemType === "QUESTION" ? "Nhập một câu hỏi Có / Không…" : "Nhập lời giải đầy đủ của OG…"}
                  disabled={formLocked}
                />
              </div>

              {formError ? <ErrorNotice message={formError} /> : null}
              {notice ? (
                <div role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">{notice}</div>
              ) : null}

              <Button type="submit" className="w-full" disabled={formLocked || !content.trim()}>
                {submitting
                  ? "AI đang phân tích…"
                  : pendingInteractionId
                    ? "Đang chờ kết quả…"
                    : itemType === "QUESTION"
                      ? "Gửi câu hỏi"
                      : "Gửi đáp án"}
              </Button>
            </form>
          </Surface>

          <Surface className="overflow-hidden">
            <div className="border-b border-white/[0.08] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-sky-300/75">Hoạt động của OG</p>
                  <h2 className="mt-1 text-xl font-black text-white">Lịch sử vụ án</h2>
                </div>
                <StatusPill tone="neutral">Tự đồng bộ</StatusPill>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">Cập nhật khoảng mỗi 3 giây để các thiết bị cùng thấy câu hỏi và kết quả mới.</p>
            </div>

            {syncWarning ? (
              <div role="status" className="border-b border-amber-300/15 bg-amber-300/[0.06] px-5 py-3 text-xs leading-5 text-amber-100">{syncWarning}</div>
            ) : null}

            {history.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Chưa có hoạt động" detail="Nội dung đầu tiên của OG trong vụ án này sẽ xuất hiện tại đây." />
              </div>
            ) : (
              <ol className="divide-y divide-white/[0.08]">
                {history.map(({ interaction, item, result }) => (
                  <li key={`${interaction.id}:${item.id}`} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                        {item.type === "QUESTION" ? "Câu hỏi" : "Đáp án cuối"}
                      </span>
                      <StatusPill tone={resultTone(result, interaction.status)}>
                        {resultLabel(result, interaction.status)}
                      </StatusPill>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-stone-200">{item.content}</p>
                    <p className="mt-3 text-xs text-stone-500">{formatDateTime(interaction.submittedAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
