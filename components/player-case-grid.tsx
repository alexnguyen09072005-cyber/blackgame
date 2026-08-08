"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchJson, getErrorMessage } from "./client-api";
import { CooldownStatus, useRemainingSeconds } from "./countdown";
import type { PublicCase, TeamSummary } from "./game-types";
import { PlayerHeader } from "./player-header";
import {
  Button,
  ErrorNotice,
  LoadingBlock,
  PageShell,
  SectionHeading,
  StatusPill,
  Surface,
  buttonClass,
  cn,
} from "./ui";

type PlayerUser = {
  role: "player";
  teamId: string;
  username: string;
  name: string;
};

type SessionResponse = { data: { user: PlayerUser | { role: string } | null } };

type PlayerInteraction = {
  id: string;
  teamId: string;
  submittedAt: number;
  status: string;
  items: Array<{ id: string; caseId: string; type: string; content: string }>;
  results?: Array<{ itemId: string; itemType: string; verdict: string | null; finalCorrect: boolean | null }> | null;
};

type PlayerStateResponse = {
  data: {
    team: TeamSummary;
    cases: PublicCase[];
    interactions: PlayerInteraction[];
  };
};

export function PlayerCaseGrid() {
  const router = useRouter();
  const [user, setUser] = useState<PlayerUser | null>(null);
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [apiCases, setApiCases] = useState<PublicCase[]>([]);
  const [interactions, setInteractions] = useState<PlayerInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const previousCooldownRemainingRef = useRef(0);
  const cooldownRemaining = useRemainingSeconds(team?.cooldownUntil);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await fetchJson<SessionResponse>("/api/auth/session");
      if (!session.data.user || session.data.user.role !== "player") {
        router.replace("/dang-nhap");
        return;
      }
      setUser(session.data.user as PlayerUser);

      try {
        const state = await fetchJson<PlayerStateResponse>("/api/player/state");
        if (!Array.isArray(state.data.cases) || state.data.cases.length !== 9) {
          throw new Error("Dữ liệu vụ án chưa đầy đủ: hệ thống phải có đúng 9 vụ án.");
        }
        setTeam(state.data.team);
        setApiCases([...state.data.cases].sort((left, right) => left.number - right.number));
        setInteractions(state.data.interactions || []);
      } catch (stateError) {
        if (stateError instanceof ApiError && stateError.status === 401) {
          router.replace("/dang-nhap");
          return;
        }
        setError(
          stateError instanceof ApiError &&
            (stateError.status === 404 || stateError.status === 501 || stateError.status === 503)
            ? "Không thể tải dữ liệu 9 vụ án. Vui lòng báo Ban tổ chức kiểm tra dịch vụ."
            : getErrorMessage(stateError),
        );
      }
    } catch (sessionError) {
      if (sessionError instanceof ApiError && sessionError.status === 401) {
        router.replace("/dang-nhap");
        return;
      }
      setError(
        sessionError instanceof ApiError &&
          (sessionError.status === 404 || sessionError.status === 501 || sessionError.status === 503)
          ? "Hệ thống người chơi chưa được cấu hình. Vui lòng báo Ban tổ chức."
          : getErrorMessage(sessionError),
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previousRemaining = previousCooldownRemainingRef.current;
    previousCooldownRemainingRef.current = cooldownRemaining;
    if (previousRemaining <= 0 || cooldownRemaining !== 0) return;

    void fetchJson<PlayerStateResponse>("/api/player/state")
      .then((state) => {
        setTeam(state.data.team);
        setApiCases([...state.data.cases].sort((left, right) => left.number - right.number));
        setInteractions(state.data.interactions || []);
      })
      .catch((stateError: unknown) => {
        if (stateError instanceof ApiError && stateError.status === 401) {
          router.replace("/dang-nhap");
        }
      });
  }, [cooldownRemaining, router]);

  const solvedIds = useMemo(
    () => new Set((team?.solvedCases || []).map((item) => item.caseId)),
    [team?.solvedCases],
  );
  const touchedIds = useMemo(
    () => new Set(interactions.flatMap((interaction) => interaction.items.map((item) => item.caseId))),
    [interactions],
  );

  if (loading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><LoadingBlock label="Đang mở danh sách vụ án…" /></div>
      </PageShell>
    );
  }

  if (error || !user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
          <ErrorNotice message={error || "Không tìm thấy phiên người chơi."} />
          <Button className="mt-4 w-full" onClick={() => router.replace("/dang-nhap")}>Về trang đăng nhập</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PlayerHeader playerName={team?.name || user.name} />
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <SectionHeading
          eyebrow={`Hồ sơ của ${team?.name || user.name}`}
          title="Chọn một vụ án"
          detail="Mở vụ án, đọc đề bài công khai rồi gửi từng câu hỏi hoặc đáp án để cả OG cùng theo dõi."
          action={
            <Link href="/bang-xep-hang" className={buttonClass("secondary")}>
              Bảng xếp hạng
            </Link>
          }
        />

        {team ? (
          <div className={cn("mt-6 grid grid-cols-2 gap-3", cooldownRemaining > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
            <Surface className="p-4">
              <p className="text-xs text-stone-500">Đã giải</p>
              <p className="mt-1 text-2xl font-black text-white">{team.solvedCount}/9</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs text-stone-500">Câu hỏi đã dùng</p>
              <p className="mt-1 text-2xl font-black text-white">{team.questionCount}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-xs text-stone-500">Lượt hiện tại</p>
              <p className="mt-1 text-2xl font-black text-white">{team.turnItemsUsed}/5</p>
              <p className="mt-1 text-xs text-stone-500">Còn {team.turnItemsRemaining} nội dung</p>
            </Surface>
            {cooldownRemaining > 0 ? (
              <Surface className="p-4">
                <p className="mb-2 text-xs text-stone-500">Lượt tiếp theo</p>
                <CooldownStatus cooldownUntil={team.cooldownUntil} compact />
              </Surface>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apiCases.map((caseItem) => {
            const solved = solvedIds.has(caseItem.id);
            const touched = touchedIds.has(caseItem.id);
            return (
              <Link
                key={caseItem.id}
                href={`/vu-an/${caseItem.id}`}
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b0f]"
              >
                <Surface className="flex h-full min-h-64 flex-col overflow-hidden transition group-hover:-translate-y-0.5 group-hover:border-white/20">
                  <div className={cn("h-1.5", solved ? "bg-emerald-400" : touched ? "bg-sky-400" : "bg-amber-300/70")} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                        Hồ sơ {String(caseItem.number).padStart(2, "0")}
                      </span>
                      <StatusPill tone={solved ? "success" : !caseItem.enabled ? "warning" : touched ? "info" : "neutral"}>
                        {solved ? "Đã giải" : !caseItem.enabled ? "Tạm khóa" : touched ? "Đã tương tác" : "Chưa giải"}
                      </StatusPill>
                    </div>
                    <h2 className="mt-5 text-2xl font-black text-white">{caseItem.title}</h2>
                    <p className="mt-1 text-xs text-stone-500">Độ khó: {caseItem.difficulty}</p>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-stone-400">{caseItem.publicStory}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4 text-sm font-bold text-amber-200">
                      <span>Mở vụ án</span><span aria-hidden="true">→</span>
                    </div>
                  </div>
                </Surface>
              </Link>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
