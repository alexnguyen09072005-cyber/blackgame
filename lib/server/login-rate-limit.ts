import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { ApiError } from "./http";

export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
export const LOGIN_RATE_LIMIT_PER_IP = 30;
export const LOGIN_RATE_LIMIT_GLOBAL = 60;

const MAX_FORWARDED_FOR_LENGTH = 512;
const MAX_FORWARDED_HOPS = 16;

type LoginRateLimitStore = {
  bucket: number;
  globalCount: number;
  ipCounts: Map<string, number>;
};

const globalWithLoginRateLimit = globalThis as typeof globalThis & {
  __blackStoriesLoginRateLimitStore?: LoginRateLimitStore;
};

type LoginRateLimitOptions = {
  now?: number;
};

function loginRateLimitStore(): LoginRateLimitStore {
  globalWithLoginRateLimit.__blackStoriesLoginRateLimitStore ??= {
    bucket: -1,
    globalCount: 0,
    ipCounts: new Map<string, number>(),
  };
  return globalWithLoginRateLimit.__blackStoriesLoginRateLimitStore;
}

/**
 * Vercel supplies x-forwarded-for. We use only the nearest (right-most) hop so
 * a client-controlled value prepended to the chain cannot mint arbitrary
 * limiter identities. Invalid or unusually large chains share one strict
 * fallback bucket.
 */
export function clientAddressFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor || forwardedFor.length > MAX_FORWARDED_FOR_LENGTH) {
    return "unknown";
  }

  const hops = forwardedFor.split(",");
  if (hops.length > MAX_FORWARDED_HOPS) {
    return "unknown";
  }

  const nearestHop = hops.at(-1)?.trim() ?? "";
  return isIP(nearestHop) > 0 ? nearestHop.toLowerCase() : "unknown";
}

export function hashClientAddress(address: string): string {
  return createHash("sha256").update(address, "utf8").digest("hex");
}

function retryAfterSeconds(now: number): number {
  const windowMilliseconds = LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1_000;
  const nextWindow =
    (Math.floor(now / windowMilliseconds) + 1) * windowMilliseconds;
  return Math.max(1, Math.ceil((nextWindow - now) / 1_000));
}

/**
 * Charges a login attempt before the synchronous scrypt verification runs.
 * The process-local store deliberately lives on globalThis so Fast Refresh does
 * not reset it during local development. On Vercel, each instance has its own
 * counter; this is a lightweight guard for this small app, not a distributed
 * rate limiter.
 */
export async function enforceLoginRateLimit(
  request: Request,
  options: LoginRateLimitOptions = {},
): Promise<void> {
  const now = options.now ?? Date.now();
  const windowMilliseconds = LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1_000;
  const bucket = Math.floor(now / windowMilliseconds);
  const addressHash = hashClientAddress(
    clientAddressFromHeaders(request.headers),
  );

  const store = loginRateLimitStore();
  if (store.bucket !== bucket) {
    store.bucket = bucket;
    store.globalCount = 0;
    store.ipCounts.clear();
  }

  const ipCount = (store.ipCounts.get(addressHash) ?? 0) + 1;
  store.ipCounts.set(addressHash, ipCount);
  store.globalCount += 1;

  if (
    ipCount > LOGIN_RATE_LIMIT_PER_IP ||
    store.globalCount > LOGIN_RATE_LIMIT_GLOBAL
  ) {
    throw new ApiError(
      429,
      "LOGIN_RATE_LIMITED",
      "Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
      { retryAfterSeconds: retryAfterSeconds(now) },
    );
  }
}
