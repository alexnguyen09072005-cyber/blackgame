import { afterEach, describe, expect, it, vi } from "vitest";

import { withApiErrors } from "../../lib/server/http";
import {
  RedisConfigurationError,
  RedisUnavailableError,
} from "../../lib/server/redis";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HTTP Redis error mapping", () => {
  it("trả 503 an toàn khi thiếu cấu hình", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrors(async (): Promise<Response> => {
      throw new RedisConfigurationError();
    });

    const response = await handler();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "REDIS_NOT_CONFIGURED",
      message: "Kho dữ liệu dùng chung chưa được cấu hình.",
      requestId: expect.any(String),
    });
    expect(logger).toHaveBeenCalledWith(
      "[api] Kho dữ liệu không khả dụng",
      expect.objectContaining({ name: "RedisConfigurationError" }),
    );
  });

  it("không lộ lỗi SDK, endpoint hoặc token khi Redis gián đoạn", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrors(async (): Promise<Response> => {
      throw new RedisUnavailableError(
        new Error("https://secret.upstash.io token-secret"),
      );
    });

    const response = await handler();
    const payload = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(payload).toContain("REDIS_UNAVAILABLE");
    expect(payload).toContain('"reason":"UNKNOWN"');
    expect(payload).toContain('"diagnostic":"UNKNOWN"');
    expect(payload).not.toContain("secret.upstash.io");
    expect(payload).not.toContain("token-secret");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("secret.upstash.io");
  });
});
