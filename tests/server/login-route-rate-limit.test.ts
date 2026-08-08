import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatePlayer: vi.fn(),
  enforceLoginRateLimit: vi.fn(),
  publicPlayer: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  authenticatePlayer: mocks.authenticatePlayer,
  publicPlayer: mocks.publicPlayer,
  setSession: mocks.setSession,
}));

vi.mock("@/lib/server/login-rate-limit", () => ({
  enforceLoginRateLimit: mocks.enforceLoginRateLimit,
}));

import { POST } from "../../app/api/auth/login/route";
import { ApiError } from "../../lib/server/http";

function loginRequest(): Request {
  return new Request("https://example.test/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify({ username: "og01", password: "password" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login rate limit", () => {
  it("chặn trước khi chạy password verification", async () => {
    mocks.enforceLoginRateLimit.mockRejectedValueOnce(
      new ApiError(
        429,
        "LOGIN_RATE_LIMITED",
        "Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
        { retryAfterSeconds: 37 },
      ),
    );

    const response = await POST(loginRequest());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "LOGIN_RATE_LIMITED",
      message: "Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
      retryAfterSeconds: 37,
    });
    expect(mocks.enforceLoginRateLimit).toHaveBeenCalledOnce();
    expect(mocks.enforceLoginRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
    );
    expect(mocks.authenticatePlayer).not.toHaveBeenCalled();
  });
});
