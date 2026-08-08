"use client";

import { useEffect, useState } from "react";
import { formatClock } from "./client-api";
import { StatusPill } from "./ui";

export function useRemainingSeconds(cooldownUntil: number | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= cooldownUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  return cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1_000))
    : 0;
}

export function CooldownStatus({
  cooldownUntil,
  compact = false,
}: {
  cooldownUntil: number | null | undefined;
  compact?: boolean;
}) {
  const remaining = useRemainingSeconds(cooldownUntil);
  if (remaining <= 0) return null;

  const label = compact
    ? `Chờ ${formatClock(remaining)}`
    : `Bạn có thể bắt đầu lượt tiếp theo sau ${formatClock(remaining)}`;

  return <StatusPill tone="warning">{label}</StatusPill>;
}
