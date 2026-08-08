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

  constructor(cause?: unknown) {
    super("Kho dữ liệu tạm thời không khả dụng. Vui lòng thử lại.", {
      cause,
    });
    this.name = "RedisUnavailableError";
  }
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
