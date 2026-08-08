import "server-only";

import { Redis } from "@upstash/redis";

const DEFAULT_REDIS_PREFIX = "blackgame:v1";
const MAX_REDIS_URL_LENGTH = 2_048;
const MAX_REDIS_TOKEN_LENGTH = 8_192;
const MAX_REDIS_PREFIX_LENGTH = 80;

const REDIS_ENV_PAIRS = [
  {
    url: "UPSTASH_REDIS_REST_URL",
    token: "UPSTASH_REDIS_REST_TOKEN",
  },
  {
    // Vercel Marketplace prepends the project's custom integration prefix.
    url: "UPSTASH_REDIS_REST_KV_REST_API_URL",
    token: "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
  },
  {
    // Legacy Vercel KV/Upstash integrations use these aliases.
    url: "KV_REST_API_URL",
    token: "KV_REST_API_TOKEN",
  },
] as const;

type RedisCredentials = {
  url: string;
  token: string;
};

type CachedRedis = RedisCredentials & {
  client: Redis;
};

export type RedisFailureReason =
  | "AUTH"
  | "NETWORK"
  | "COMMAND"
  | "RESPONSE"
  | "UNKNOWN";

export type RedisFailureDiagnostic =
  | "CREDENTIALS"
  | "PERMISSION"
  | "CROSS_SLOT"
  | "SCRIPT"
  | "STATE_SCHEMA"
  | "UPSTASH_JSON"
  | "LOCAL_JSON"
  | "FETCH"
  | "TIMEOUT"
  | "UNKNOWN";

let cachedRedis: CachedRedis | undefined;

export class RedisConfigurationError extends Error {
  readonly code = "REDIS_NOT_CONFIGURED";

  constructor() {
    super("Kho dữ liệu dùng chung chưa được cấu hình.");
    this.name = "RedisConfigurationError";
  }
}

export class RedisUnavailableError extends Error {
  readonly code = "REDIS_UNAVAILABLE";
  readonly reason: RedisFailureReason;
  readonly diagnostic: RedisFailureDiagnostic;

  constructor(cause?: unknown) {
    super("Kho dữ liệu tạm thời không khả dụng. Vui lòng thử lại.", {
      cause,
    });
    this.name = "RedisUnavailableError";
    this.reason = classifyRedisFailure(cause);
    this.diagnostic = classifyRedisDiagnostic(cause);
  }
}

function redisErrorSummary(error: unknown): { name: string; summary: string } {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return { name, summary: `${name} ${message}`.toLowerCase() };
}

function classifyRedisDiagnostic(error: unknown): RedisFailureDiagnostic {
  const { name, summary } = redisErrorSummary(error);
  if (name === "ZodError") return "STATE_SCHEMA";
  if (name === "UpstashJSONParseError") return "UPSTASH_JSON";
  if (name === "SyntaxError") return "LOCAL_JSON";
  if (/wrongpass|unauthori[sz]ed|invalid[^\n]{0,30}(token|password)|\b401\b/.test(summary)) {
    return "CREDENTIALS";
  }
  if (/forbidden|readonly|noperm|\b403\b/.test(summary)) return "PERMISSION";
  if (/crossslot/.test(summary)) return "CROSS_SLOT";
  if (/unknown command|command failed|user_script|\beval\b|\bscript\b/.test(summary)) {
    return "SCRIPT";
  }
  if (/timed? ?out|timeout|aborted/.test(summary)) return "TIMEOUT";
  if (/fetch failed|network|econn|enotfound|socket|\bdns\b|exhausted all retries/.test(summary)) {
    return "FETCH";
  }
  return "UNKNOWN";
}

function classifyRedisFailure(error: unknown): RedisFailureReason {
  const { name, summary } = redisErrorSummary(error);

  if (
    /unauthori[sz]ed|forbidden|wrongpass|invalid[^\n]{0,30}(token|password)|authenticat|\b401\b|\b403\b/.test(
      summary,
    )
  ) {
    return "AUTH";
  }
  if (
    /crossslot|unknown command|command failed|user_script|\beval\b|\bscript\b|readonly|noperm/.test(
      summary,
    )
  ) {
    return "COMMAND";
  }
  if (
    name === "ZodError" ||
    name === "SyntaxError" ||
    name === "UpstashJSONParseError" ||
    /parse response|invalid[^\n]{0,30}response/.test(summary)
  ) {
    return "RESPONSE";
  }
  if (
    /fetch failed|network|timed? ?out|timeout|econn|enotfound|socket|\bdns\b|aborted|exhausted all retries/.test(
      summary,
    )
  ) {
    return "NETWORK";
  }
  return "UNKNOWN";
}

function environmentValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function redisCredentials(): RedisCredentials {
  for (const pair of REDIS_ENV_PAIRS) {
    const url = environmentValue(pair.url);
    const token = environmentValue(pair.token);

    if (!url && !token) {
      continue;
    }
    // Never combine a URL from one integration with a token from another.
    if (!url || !token) {
      throw new RedisConfigurationError();
    }
    if (url.length > MAX_REDIS_URL_LENGTH) {
      throw new RedisConfigurationError();
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new RedisConfigurationError();
    }
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new RedisConfigurationError();
    }
    if (
      token.length < 16 ||
      token.length > MAX_REDIS_TOKEN_LENGTH ||
      /\s/.test(token)
    ) {
      throw new RedisConfigurationError();
    }

    return { url: parsedUrl.toString().replace(/\/$/, ""), token };
  }

  throw new RedisConfigurationError();
}

export function getRedisKeyPrefix(): string {
  const prefix =
    environmentValue("BLACKGAME_REDIS_PREFIX") ?? DEFAULT_REDIS_PREFIX;
  if (
    prefix.length > MAX_REDIS_PREFIX_LENGTH ||
    !/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(prefix)
  ) {
    throw new RedisConfigurationError();
  }
  return prefix;
}

export function redisKey(...parts: string[]): string {
  if (
    parts.length === 0 ||
    parts.some(
      (part) =>
        part.length === 0 ||
        part.length > 200 ||
        !/^[a-zA-Z0-9_-]+$/.test(part),
    )
  ) {
    throw new RedisConfigurationError();
  }
  return [getRedisKeyPrefix(), ...parts].join(":");
}

export function getRedis(): Redis {
  const credentials = redisCredentials();
  if (
    cachedRedis?.url === credentials.url &&
    cachedRedis.token === credentials.token
  ) {
    return cachedRedis.client;
  }

  const client = new Redis({
    ...credentials,
    automaticDeserialization: false,
    cache: "no-store",
    enableAutoPipelining: true,
    enableTelemetry: false,
    readYourWrites: true,
    retry: {
      retries: 2,
      backoff: (attempt) => Math.min(250, 50 * 2 ** attempt),
    },
  });
  cachedRedis = { ...credentials, client };
  return client;
}

/** Converts SDK, HTTP and malformed Redis response failures to one safe error. */
export async function runRedisOperation<T>(
  operation: (redis: Redis) => Promise<T>,
): Promise<T> {
  let redis: Redis;
  try {
    redis = getRedis();
  } catch (error) {
    if (error instanceof RedisConfigurationError) {
      throw error;
    }
    throw new RedisUnavailableError(error);
  }

  try {
    return await operation(redis);
  } catch (error) {
    if (
      error instanceof RedisConfigurationError ||
      error instanceof RedisUnavailableError
    ) {
      throw error;
    }
    throw new RedisUnavailableError(error);
  }
}

export function resetRedisClientForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Chỉ được reset Redis client trong môi trường test.");
  }
  cachedRedis = undefined;
}
