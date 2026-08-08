import { describe, expect, it } from "vitest";

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
});
