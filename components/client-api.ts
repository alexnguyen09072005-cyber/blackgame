export type ApiErrorPayload = {
  error?: string;
  message?: string;
  retryAfterSeconds?: number;
  cooldownUntil?: number;
  interactionId?: string;
  recorded?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  cooldownUntil?: number;
  interactionId?: string;
  recorded?: boolean;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error;
    this.retryAfterSeconds = payload.retryAfterSeconds;
    this.cooldownUntil = payload.cooldownUntil;
    this.interactionId = payload.interactionId;
    this.recorded = payload.recorded;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new ApiError(response.status, payload as ApiErrorPayload);
  }

  return payload as T;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (
    error instanceof Error &&
    /[À-ỹ]|Không|Đã|Vui lòng|Lỗi|dữ liệu|máy chủ/i.test(error.message)
  ) {
    return error.message;
  }
  return "Không thể kết nối với máy chủ. Vui lòng thử lại.";
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const DEFAULT_EVENT_TIMEZONE = "Asia/Singapore";

export function getEventTimezone(): string {
  if (typeof document === "undefined") return DEFAULT_EVENT_TIMEZONE;
  const configured = document.documentElement.dataset.eventTimezone?.trim();
  return configured || DEFAULT_EVENT_TIMEZONE;
}

export function formatDateTime(value: number | string | null | undefined): string {
  if (value == null) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: getEventTimezone(),
  }).format(date);
}
