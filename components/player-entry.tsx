"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchJson } from "./client-api";
import { Brand, LoadingBlock, PageShell } from "./ui";

type SessionResponse = {
  data: {
    user: { role: string } | null;
  };
};

export function PlayerEntry() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void fetchJson<SessionResponse>("/api/auth/session")
      .then((response) => {
        if (!active) return;
        router.replace(response.data.user?.role === "player" ? "/vu-an" : "/dang-nhap");
      })
      .catch(() => {
        if (active) router.replace("/dang-nhap");
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <PageShell>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
        <div className="mb-8 flex justify-center"><Brand /></div>
        <LoadingBlock label="Đang mở hồ sơ của bạn…" />
      </div>
    </PageShell>
  );
}

