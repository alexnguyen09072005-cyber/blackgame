import "server-only";

import { ZodError, type ZodType } from "zod";

const MAX_JSON_BODY_BYTES = 32 * 1024;

async function readBoundedRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<string> {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel("payload too large");
        } catch {
          // The 413 below is authoritative even if the producer already closed.
        }
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Dữ liệu JSON không hợp lệ.");
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function responseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export function jsonOk<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: responseHeaders(headers),
  });
}

export function jsonError(error: ApiError): Response {
  return new Response(
    JSON.stringify({
      error: error.code,
      message: error.message,
      ...(error.details ?? {}),
    }),
    {
      status: error.status,
      headers: responseHeaders(),
    },
  );
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Yêu cầu phải dùng định dạng JSON.",
    );
  }

  // Read incrementally and cancel as soon as the limit is crossed. request.text()
  // would buffer an untrusted body in full before we could enforce the cap.
  const raw = await readBoundedRequestBody(request, MAX_JSON_BODY_BYTES);

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Dữ liệu JSON không hợp lệ.");
  }
  return schema.parse(value);
}

export type ApiHandler = (...args: never[]) => Promise<Response> | Response;

export function withApiErrors<T extends ApiHandler>(handler: T): T {
  return (async (...args: Parameters<T>): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonError(error);
      }
      if (error instanceof ZodError) {
        return jsonError(
          new ApiError(400, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", {
            fields: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          }),
        );
      }
      const requestId = crypto.randomUUID();
      // Never send a stack trace or possibly secret-rich upstream error to the client.
      console.error("[api] Lỗi không mong đợi", {
        requestId,
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return jsonError(
        new ApiError(
          500,
          "INTERNAL_ERROR",
          "Đã xảy ra lỗi. Vui lòng thử lại.",
          { requestId },
        ),
      );
    }
  }) as T;
}

export function normalizeRouteId(value: string): string {
  const id = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    throw new ApiError(400, "INVALID_ID", "Mã định danh không hợp lệ.");
  }
  return id;
}
