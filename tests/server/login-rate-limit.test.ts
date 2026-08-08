import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
  runRedisOperation: vi.fn(),
}));

vi.mock("../../lib/server/redis", () => ({
  RedisConfigurationError: class RedisConfigurationError extends Error {},
  RedisUnavailableError: class RedisUnavailableError extends Error {},
  redisKey: (...parts: string[]) => ["blackgame:v1", ...parts].join(":"),
  runRedisOperation: mocks.runRedisOperation,
}));

import {
  clientAddressFromHeaders,
  enforceLoginRateLimit,
  hashClientAddress,
  LOGIN_RATE_LIMIT_GLOBAL,
  LOGIN_RATE_LIMIT_PER_IP,
} from "../../lib/server/login-rate-limit";

function requestWithForwardedFor(value?: string): Request {
  return new Request("https://example.test/api/auth/login", {
    method: "POST",
    headers: value ? { "x-forwarded-for": value } : undefined,
  });
}

async function chargeAttempts(
  count: number,
  address: string,
  now: number,
): Promise<void> {
  for (let attempt = 0; attempt < count; attempt += 1) {
    await enforceLoginRateLimit(requestWithForwardedFor(address), { now });
  }
}

beforeEach(() => {
  const counters = new Map<string, number>();
  mocks.eval.mockReset();
  mocks.eval.mockImplementation(
    async (_script: string, keys: string[]) =>
      keys.map((key) => {
        const count = (counters.get(key) ?? 0) + 1;
        counters.set(key, count);
        return count;
      }),
  );
  mocks.runRedisOperation.mockReset();
  mocks.runRedisOperation.mockImplementation(
    async (operation: (redis: { eval: typeof mocks.eval }) => Promise<unknown>) =>
      operation({ eval: mocks.eval }),
  );
});

describe("login rate limiter", () => {
  it("dùng hop gần nhất đã kiểm tra định dạng và gom header lỗi vào bucket chung", () => {
    expect(
      clientAddressFromHeaders(
        new Headers({
          "x-forwarded-for": "198.51.100.10, 203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
    expect(
      clientAddressFromHeaders(
        new Headers({ "x-forwarded-for": "198.51.100.10, forged" }),
      ),
    ).toBe("unknown");
    expect(clientAddressFromHeaders(new Headers())).toBe("unknown");
  });

  it("băm địa chỉ trước khi dùng làm định danh bộ đếm", () => {
    const address = "203.0.113.7";
    expect(hashClientAddress(address)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashClientAddress(address)).not.toContain(address);
    expect(hashClientAddress(address)).toBe(hashClientAddress(address));
  });

  it("cho phép đúng cap IP rồi chặn lần kế tiếp", async () => {
    const address = "203.0.113.7";
    const now = 125_000;

    await expect(
      chargeAttempts(LOGIN_RATE_LIMIT_PER_IP, address, now),
    ).resolves.toBeUndefined();

    await expect(
      enforceLoginRateLimit(requestWithForwardedFor(address), { now }),
    ).rejects.toMatchObject({
      status: 429,
      code: "LOGIN_RATE_LIMITED",
      message: "Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
      details: { retryAfterSeconds: 55 },
    });
  });

  it("cho phép đúng cap toàn cục rồi chặn lần kế tiếp", async () => {
    const now = 245_000;
    for (let attempt = 1; attempt <= LOGIN_RATE_LIMIT_GLOBAL; attempt += 1) {
      await expect(
        enforceLoginRateLimit(
          requestWithForwardedFor(`2001:db8::${attempt.toString(16)}`),
          { now },
        ),
      ).resolves.toBeUndefined();
    }

    await expect(
      enforceLoginRateLimit(requestWithForwardedFor("2001:db8::ffff"), {
        now,
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: "LOGIN_RATE_LIMITED",
      details: { retryAfterSeconds: 55 },
    });
  });

  it("reset bộ đếm ở ranh giới fixed window 60 giây", async () => {
    const address = "203.0.113.9";
    await chargeAttempts(LOGIN_RATE_LIMIT_PER_IP, address, 359_999);

    await expect(
      enforceLoginRateLimit(requestWithForwardedFor(address), {
        now: 360_000,
      }),
    ).resolves.toBeUndefined();
  });

  it("tăng counter IP và global trong cùng một Lua operation có TTL", async () => {
    await enforceLoginRateLimit(
      requestWithForwardedFor("203.0.113.11"),
      { now: 125_000 },
    );

    expect(mocks.runRedisOperation).toHaveBeenCalledOnce();
    expect(mocks.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("INCR", KEYS[1])'),
      [
        `blackgame:v1:login:ip:${hashClientAddress("203.0.113.11")}:2`,
        "blackgame:v1:login:global:2",
      ],
      ["120"],
    );
  });

  it("fail closed nếu Redis không khả dụng", async () => {
    mocks.runRedisOperation.mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );

    await expect(
      enforceLoginRateLimit(requestWithForwardedFor("203.0.113.12")),
    ).rejects.toThrow("Redis unavailable");
  });
});
