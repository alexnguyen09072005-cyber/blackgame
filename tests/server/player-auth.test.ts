import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authenticatePlayer,
  createSessionToken,
  verifySessionToken,
} from "../../lib/server/auth";
import { ApiError } from "../../lib/server/http";
import { OG_ACCOUNTS } from "../../lib/server/og-accounts";

function printableCredentials(): Array<{
  username: string;
  password: string;
}> {
  const document = readFileSync(
    resolve(process.cwd(), "docs/OG_ACCOUNTS.md"),
    "utf8",
  );
  return [...document.matchAll(/^\| OG \d{2} \| `([^`]+)` \| `([^`]+)` \|$/gm)].map(
    (match) => ({ username: match[1]!, password: match[2]! }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tài khoản người chơi", () => {
  it("12 credential trong bản in khớp 12 scrypt hash runtime", () => {
    const credentials = printableCredentials();
    expect(credentials).toHaveLength(12);
    expect(OG_ACCOUNTS).toHaveLength(12);
    expect(new Set(OG_ACCOUNTS.map((account) => account.username)).size).toBe(12);
    expect(new Set(OG_ACCOUNTS.map((account) => account.passwordHash)).size).toBe(12);

    for (const { username, password } of credentials) {
      const principal = authenticatePlayer(username, password);
      expect(principal).toEqual({
        role: "PLAYER",
        username,
        teamId: `og-${username.slice(2)}`,
      });
      expect(JSON.stringify(OG_ACCOUNTS)).not.toContain(password);
    }
  });

  it("trả cùng kết quả null cho username lạ và mật khẩu sai", () => {
    expect(authenticatePlayer("og01", "mat-khau-sai")).toBeNull();
    expect(authenticatePlayer("khong-ton-tai", "mat-khau-sai")).toBeNull();
  });
});

describe("player session token", () => {
  const principal = {
    role: "PLAYER" as const,
    teamId: "og-01",
    username: "og01",
  };

  it("xác minh token hợp lệ, từ chối token bị sửa và token hết hạn", () => {
    vi.stubEnv("SESSION_SECRET", "a-production-ready-session-secret-123456789");
    const now = 1_000_000;
    const token = createSessionToken(principal, now);
    expect(verifySessionToken(token, now + 1_000)).toEqual(principal);

    const separator = token.lastIndexOf(".");
    const signature = token.slice(separator + 1);
    const tampered = `${token.slice(0, separator + 1)}${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    expect(verifySessionToken(tampered, now + 1_000)).toBeNull();
    expect(verifySessionToken(token, now + 24 * 60 * 60 * 1_000 + 1)).toBeNull();
  });

  it("yêu cầu SESSION_SECRET >=32 ký tự trong production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "qua-ngan");
    expect(() => createSessionToken(principal)).toThrowError(ApiError);
  });

  it("có secret chỉ dành cho local khi dev/test chưa đặt env", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "");
    const token = createSessionToken(principal, 5_000);
    expect(verifySessionToken(token, 5_001)).toEqual(principal);
  });
});
