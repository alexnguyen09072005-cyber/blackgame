import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { ApiError } from "./http";
import { redisKey, runRedisOperation } from "./redis";

export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
export const LOGIN_RATE_LIMIT_PER_IP = 30;
export const LOGIN_RATE_LIMIT_GLOBAL = 60;

const MAX_FORWARDED_FOR_LENGTH = 512;
const MAX_FORWARDED_HOPS = 16;
const LOGIN_RATE_LIMIT_KEY_TTL_SECONDS =
  LOGIN_RATE_LIMIT_WINDOW_SECONDS * 2;

const CHARGE_LOGIN_ATTEMPT_SCRIPT = `
local ipCount = redis.call("INCR", KEYS[1])
if ipCount == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end

local globalCount = redis.call("INCR", KEYS[2])
if globalCount == 1 then
  redis.call("EXPIRE", KEYS[2], ARGV[1])
end

return { ipCount, globalCount }
`;

type LoginRateLimitOptions = {
  now?: number;
};

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
 * Charges the per-IP and global fixed-window counters atomically before the
 * synchronous scrypt verification runs. Missing or unavailable Redis fails
 * closed, so short event access codes never bypass the distributed limiter.
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
  const ipKey = redisKey("login", "ip", addressHash, String(bucket));
  const globalKey = redisKey("login", "global", String(bucket));

  const [ipCount, globalCount] = await runRedisOperation(async (redis) => {
    const result = await redis.eval<unknown[]>(
      CHARGE_LOGIN_ATTEMPT_SCRIPT,
      [ipKey, globalKey],
      [String(LOGIN_RATE_LIMIT_KEY_TTL_SECONDS)],
    );
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      result.some(
        (value) =>
          !Number.isSafeInteger(Number(value)) || Number(value) < 1,
      )
    ) {
      throw new Error("Invalid login rate-limit response");
    }
    return [Number(result[0]), Number(result[1])] as const;
  });

  if (
    ipCount > LOGIN_RATE_LIMIT_PER_IP ||
    globalCount > LOGIN_RATE_LIMIT_GLOBAL
  ) {
    throw new ApiError(
      429,
      "LOGIN_RATE_LIMITED",
      "Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
      { retryAfterSeconds: retryAfterSeconds(now) },
    );
  }
}
