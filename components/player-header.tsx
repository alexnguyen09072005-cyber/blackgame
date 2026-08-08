"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "./client-api";
import { Brand, Button } from "./ui";

export function PlayerHeader({
  playerName,
  backHref,
}: {
  playerName?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
    } catch {
      // A missing/expired session has the same outcome for the player.
    } finally {
      router.replace("/dang-nhap");
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <header className="border-b border-white/[0.08] bg-[#090b0f]/90 backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Quay lại danh sách vụ án"
              className="grid size-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xl text-stone-200 hover:bg-white/[0.08]"
            >
              ←
            </Link>
          ) : null}
          <Link href="/vu-an" className={backHref ? "hidden sm:block" : "block"} aria-label="Danh sách vụ án">
            <Brand compact />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {playerName ? (
            <span className="hidden max-w-48 truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-stone-300 sm:inline-flex">
              {playerName}
            </span>
          ) : null}
          <Button variant="ghost" className="min-h-11 px-3" onClick={logout} disabled={busy}>
            {busy ? "Đang thoát…" : "Đăng xuất"}
          </Button>
        </div>
      </div>
    </header>
  );
}

