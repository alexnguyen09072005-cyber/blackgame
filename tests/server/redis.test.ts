import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(options: unknown) {
      mocks.constructor(options);
    }
  },
}));

import {
  getRedis,
  getRedisKeyPrefix,
  RedisConfigurationError,
  RedisUnavailableError,
  redisKey,
  resetRedisClientForTests,
  runRedisOperation,
} from "../../lib/server/redis";

const REDIS_ENV_NAMES = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_KV_REST_API_URL",
  "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "BLACKGAME_REDIS_PREFIX",
] as const;

const originalEnvironment = Object.fromEntries(
  REDIS_ENV_NAMES.map((name) => [name, process.env[name]]),
);

beforeEach(() => {
  for (const name of REDIS_ENV_NAMES) {
    delete process.env[name];
  }
  mocks.constructor.mockClear();
  resetRedisClientForTests();
});

afterAll(() => {
  for (const name of REDIS_ENV_NAMES) {
    const value = originalEnvironment[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("Redis server client", () => {
  it("dùng credentials Upstash chuẩn và cache client an toàn", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io/";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-that-is-long-enough";

    const first = getRedis();
    const second = getRedis();

    expect(second).toBe(first);
    expect(mocks.constructor).toHaveBeenCalledOnce();
    expect(mocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.upstash.io",
        token: "token-that-is-long-enough",
        automaticDeserialization: false,
        cache: "no-store",
        enableAutoPipelining: true,
        enableTelemetry: false,
        readYourWrites: true,
      }),
    );
  });

  it("hỗ trợ cặp alias Vercel KV cũ nhưng không trộn hai cặp", () => {
    process.env.KV_REST_API_URL = "https://legacy.upstash.io";
    process.env.KV_REST_API_TOKEN = "legacy-token-is-long-enough";

    expect(() => getRedis()).not.toThrow();
    expect(mocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://legacy.upstash.io",
        token: "legacy-token-is-long-enough",
      }),
    );

    resetRedisClientForTests();
    process.env.UPSTASH_REDIS_REST_URL = "https://partial.upstash.io";
    expect(() => getRedis()).toThrow(RedisConfigurationError);
  });

  it("hỗ trợ tên do Vercel Marketplace tạo với custom prefix", () => {
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL =
      "https://marketplace.upstash.io";
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN =
      "marketplace-token-is-long-enough";

    expect(() => getRedis()).not.toThrow();
    expect(mocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://marketplace.upstash.io",
        token: "marketplace-token-is-long-enough",
      }),
    );
  });

  it("fail closed khi credentials, URL hoặc namespace không hợp lệ", () => {
    expect(() => getRedis()).toThrowError(
      expect.objectContaining({ code: "REDIS_NOT_CONFIGURED" }),
    );

    process.env.UPSTASH_REDIS_REST_URL = "http://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-that-is-long-enough";
    expect(() => getRedis()).toThrow(RedisConfigurationError);

    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.BLACKGAME_REDIS_PREFIX = "bad prefix";
    expect(() => getRedisKeyPrefix()).toThrow(RedisConfigurationError);
  });

  it("namespace mọi key và từ chối thành phần key không an toàn", () => {
    process.env.BLACKGAME_REDIS_PREFIX = "blackgame:production:v1";

    expect(redisKey("team", "og-01")).toBe(
      "blackgame:production:v1:team:og-01",
    );
    expect(() => redisKey("team:*")).toThrow(RedisConfigurationError);
    expect(() => redisKey()).toThrow(RedisConfigurationError);
  });

  it("chuẩn hóa lỗi SDK/network mà không lộ message gốc", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-that-is-long-enough";

    const operation = runRedisOperation(async () => {
      throw new Error("secret endpoint and token");
    });

    await expect(operation).rejects.toBeInstanceOf(RedisUnavailableError);
    await expect(operation).rejects.not.toMatchObject({
      message: expect.stringContaining("secret"),
    });
  });
});
