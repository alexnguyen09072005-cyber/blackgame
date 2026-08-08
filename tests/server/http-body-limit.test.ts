import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError, readJson } from "../../lib/server/http";

const schema = z.object({ value: z.string() }).strict();

describe("giới hạn JSON body theo stream", () => {
  it("đọc JSON theo nhiều chunk khi tổng dung lượng nằm trong giới hạn", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify({ value: "hợp lệ" }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 7));
        controller.enqueue(encoded.slice(7));
        controller.close();
      },
    });
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJson(request, schema)).resolves.toEqual({ value: "hợp lệ" });
  });

  it("dừng và hủy stream ngay khi vượt 32 KB dù không có Content-Length", async () => {
    let cancelled = false;
    let pulls = 0;
    const chunk = new Uint8Array(20 * 1024).fill(120);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    try {
      await readJson(request, schema);
      throw new Error("Expected payload limit error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(413);
      expect((error as ApiError).code).toBe("PAYLOAD_TOO_LARGE");
    }
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(2);
  });

  it("từ chối Content-Length quá lớn trước khi đọc body", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([123, 125]));
        controller.close();
      },
    });
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(40 * 1024),
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJson(request, schema)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(request.bodyUsed).toBe(false);
  });
});
