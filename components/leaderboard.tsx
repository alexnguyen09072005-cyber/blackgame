"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, formatDateTime, getErrorMessage } from "./client-api";
import { braceletSwatch, type LeaderboardEntry } from "./game-types";
import {
  Brand,
  Button,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageShell,
  StatusPill,
  Surface,
  buttonClass,
  cn,
} from "./ui";

type LeaderboardResponse = { data: { leaderboard: LeaderboardEntry[] } };
type SessionResponse = {
  data: { user: { role: string; teamId?: string } | null };
};

const PODIUM_STYLES = [
  "border-amber-300/35 bg-amber-300/[0.09]",
  "border-slate-300/25 bg-slate-300/[0.06]",
  "border-orange-400/25 bg-orange-400/[0.06]",
];

function Medal({ rank }: { rank: number }) {
  const symbols: Record<number, string> = { 1: "Ⅰ", 2: "Ⅱ", 3: "Ⅲ" };
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border font-serif text-lg font-black",
        rank === 1 && "border-amber-300/40 bg-amber-300 text-stone-950",
        rank === 2 && "border-slate-300/30 bg-slate-300 text-slate-900",
        rank === 3 && "border-orange-400/30 bg-orange-400 text-stone-950",
        rank > 3 && "border-white/10 bg-white/[0.04] text-stone-400",
      )}
    >
      {symbols[rank] || rank}
    </span>
  );
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [ownedTeamIds, setOwnedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const discoverOwnedTeams = useCallback(async () => {
    try {
      const session = await fetchJson<SessionResponse>("/api/auth/session");
      if (session.data.user?.role !== "player" || !session.data.user.teamId) return;
      setOwnedTeamIds(new Set([session.data.user.teamId]));
    } catch {
      // This page is public; an anonymous session is expected and needs no warning.
    }
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetchJson<LeaderboardResponse>("/api/leaderboard");
      setEntries(response.data.leaderboard || []);
      setUpdatedAt(Date.now());
      setError("");
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void discoverOwnedTeams();
    const timer = window.setInterval(() => void load(true), 8_000);
    return () => window.clearInterval(timer);
  }, [discoverOwnedTeams, load]);

  const sorted = useMemo(() => [...entries].sort((a, b) => a.rank - b.rank), [entries]);
  const podium = sorted.slice(0, 3);

  return (
    <PageShell>
      <header className="border-b border-white/[0.08] bg-[#090b0f]/90">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Trang chủ"><Brand compact /></Link>
          <div className="flex items-center gap-2">
            {refreshing ? <StatusPill tone="info">Đang cập nhật…</StatusPill> : <StatusPill tone="success">Trực tiếp</StatusPill>}
            <Link href="/vu-an" className={cn(buttonClass("ghost"), "hidden min-h-11 sm:inline-flex")}>Danh sách vụ án</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-amber-300/80">Tiến độ điều tra</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">Bảng xếp hạng</h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-stone-400">
            Ưu tiên số vụ đã giải, thời điểm đạt thành tích, rồi đến số câu hỏi đã dùng.
          </p>
          <p className="mt-3 text-xs text-stone-600">
            {updatedAt ? `Cập nhật lúc ${formatDateTime(updatedAt)} · tự làm mới mỗi 8 giây` : "Đang kết nối dữ liệu trực tiếp"}
          </p>
        </div>

        {loading ? <div className="mt-10"><LoadingBlock label="Đang tổng hợp thành tích…" /></div> : null}
        {!loading && error && !entries.length ? (
          <div className="mx-auto mt-10 max-w-xl space-y-3">
            <ErrorNotice message={error} />
            <Button variant="secondary" className="w-full" onClick={() => void load()}>Thử lại</Button>
          </div>
        ) : null}
        {!loading && !error && !entries.length ? (
          <div className="mt-10"><EmptyState title="Cuộc điều tra chưa bắt đầu" detail="Thành tích đầu tiên sẽ xuất hiện ngay sau khi một đội giải đúng vụ án." /></div>
        ) : null}

        {!loading && entries.length ? (
          <>
            {error ? <div className="mt-6"><ErrorNotice message={`${error} Đang hiển thị dữ liệu gần nhất.`} /></div> : null}
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {podium.map((entry, index) => {
                const mine = ownedTeamIds.has(entry.teamId) || entry.isMine;
                return (
                  <Surface key={entry.teamId} className={cn("relative overflow-hidden p-5", PODIUM_STYLES[index], index === 0 && "md:-translate-y-3")}>
                    <div className="absolute inset-x-0 top-0 h-1 bg-stone-600" style={{ backgroundColor: braceletSwatch(entry.color) }} />
                    <div className="flex items-center justify-between gap-3">
                      <Medal rank={entry.rank} />
                        {mine ? <StatusPill tone="info">Đội của bạn</StatusPill> : null}
                    </div>
                    <p className="mt-5 text-sm text-stone-500">Hạng #{entry.rank}</p>
                    <h2 className="mt-1 text-2xl font-black text-white">{entry.name}</h2>
                    <div className="mt-5 flex items-end gap-5">
                      <div>
                        <p className="text-3xl font-black text-amber-200">{entry.solvedCount}</p>
                        <p className="text-xs text-stone-500">vụ đã giải</p>
                      </div>
                      <div className="pb-1">
                        <p className="text-lg font-bold text-stone-200">{entry.questionCount}</p>
                        <p className="text-xs text-stone-500">câu hỏi</p>
                      </div>
                    </div>
                  </Surface>
                );
              })}
            </div>

            <Surface className="mt-5 overflow-hidden">
              <div className="hidden grid-cols-[72px_minmax(0,1fr)_120px_120px] border-b border-white/[0.08] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:grid">
                <span>Hạng</span><span>OG</span><span className="text-right">Vụ đã giải</span><span className="text-right">Câu hỏi</span>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {sorted.map((entry) => {
                  const mine = ownedTeamIds.has(entry.teamId) || entry.isMine;
                  return (
                    <div
                      key={entry.teamId}
                      className={cn(
                        "grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[72px_minmax(0,1fr)_120px_120px] sm:px-5",
                        mine && "bg-sky-400/[0.07]",
                      )}
                    >
                      <Medal rank={entry.rank} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full bg-stone-500" style={{ backgroundColor: braceletSwatch(entry.color) }} />
                          <p className="truncate font-bold text-white">{entry.name}</p>
                        </div>
                        {mine ? <p className="mt-1 text-xs text-sky-200">Đội của bạn</p> : null}
                        <p className="mt-1 text-xs text-stone-500 sm:hidden">{entry.solvedCount} vụ · {entry.questionCount} câu</p>
                      </div>
                      <div className="text-right sm:hidden">
                        <span className="text-xl font-black text-amber-200">{entry.solvedCount}</span>
                        <span className="ml-1 text-xs text-stone-500">vụ</span>
                      </div>
                      <p className="hidden text-right text-lg font-black text-stone-100 sm:block">{entry.solvedCount}</p>
                      <p className="hidden text-right font-semibold text-stone-300 sm:block">{entry.questionCount}</p>
                    </div>
                  );
                })}
              </div>
            </Surface>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
