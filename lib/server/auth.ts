import "server-only";

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { ApiError } from "./http";
import {
  OG_ACCOUNTS,
  getOgAccountByUsername,
  type OgAccount,
} from "./og-accounts";

export const SESSION_COOKIE_NAME = "black_stories_session";
const SESSION_VERSION = 3;
const DEFAULT_SESSION_SECONDS = 60 * 60 * 24;
const DEVELOPMENT_SESSION_SECRET =
  "black-stories-local-development-secret-do-not-use-in-production";

export type PlayerPrincipal = {
  role: "PLAYER";
  teamId: string;
  username: string;
};

export type PublicPlayer = {
  role: "player";
  teamId: string;
  username: string;
  name: string;
};

type SessionPayload = {
  v: typeof SESSION_VERSION;
  role: "PLAYER";
  teamId: string;
  username: string;
  issuedAt: number;
  expiresAt: number;
};

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) {
      throw new ApiError(
        503,
        "AUTH_NOT_CONFIGURED",
        "Hệ thống đăng nhập chưa được cấu hình đầy đủ.",
      );
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Hệ thống đăng nhập chưa được cấu hình đầy đủ.",
    );
  }
  return DEVELOPMENT_SESSION_SECRET;
}

function sessionLifetimeSeconds(): number {
  const configured = Number.parseInt(
    process.env.SESSION_MAX_AGE_SECONDS ?? "",
    10,
  );
  return Number.isFinite(configured) && configured >= 60 * 60
    ? configured
    : DEFAULT_SESSION_SECONDS;
}

function verifyScryptPassword(password: string, encodedHash: string): boolean {
  const [algorithm, nValue, rValue, pValue, saltValue, derivedValue] =
    encodedHash.split("$");
  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (
    algorithm !== "scrypt" ||
    n !== 16_384 ||
    r !== 8 ||
    p !== 1 ||
    !saltValue ||
    !derivedValue
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(derivedValue, "base64url");
    const actual = scryptSync(
      password,
      Buffer.from(saltValue, "base64url"),
      expected.length,
      { N: n, r, p, maxmem: 32 * 1024 * 1024 },
    );
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function authenticatePlayer(
  usernameInput: string,
  password: string,
): PlayerPrincipal | null {
  const account = getOgAccountByUsername(usernameInput);
  // Verify a real hash for unknown usernames too, reducing username-enumeration
  // signal without storing or comparing any plaintext credential.
  const hash = account?.passwordHash ?? OG_ACCOUNTS[0]!.passwordHash;
  const passwordMatches = verifyScryptPassword(password, hash);
  if (!account || !passwordMatches) {
    return null;
  }
  return {
    role: "PLAYER",
    teamId: account.teamId,
    username: account.username,
  };
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", sessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(expected: string, supplied: string): boolean {
  try {
    const expectedBytes = Buffer.from(expected, "base64url");
    const suppliedBytes = Buffer.from(supplied, "base64url");
    return (
      expectedBytes.length === suppliedBytes.length &&
      timingSafeEqual(expectedBytes, suppliedBytes)
    );
  } catch {
    return false;
  }
}

export function createSessionToken(
  principal: PlayerPrincipal,
  now = Date.now(),
): string {
  const account = getOgAccountByUsername(principal.username);
  if (!account || account.teamId !== principal.teamId) {
    throw new ApiError(401, "INVALID_PRINCIPAL", "Tài khoản OG không hợp lệ.");
  }
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    role: "PLAYER",
    teamId: principal.teamId,
    username: principal.username,
    issuedAt: now,
    expiresAt: now + sessionLifetimeSeconds() * 1_000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(
  token: string,
  now = Date.now(),
): PlayerPrincipal | null {
  if (token.length > 2_048) {
    return null;
  }
  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }
  const encodedPayload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  if (!signaturesMatch(sign(encodedPayload), suppliedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      payload.v !== SESSION_VERSION ||
      payload.role !== "PLAYER" ||
      typeof payload.teamId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.issuedAt > now + 5 * 60_000 ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    const account = getOgAccountByUsername(payload.username);
    if (!account || account.teamId !== payload.teamId) {
      return null;
    }
    return {
      role: "PLAYER",
      teamId: account.teamId,
      username: account.username,
    };
  } catch {
    return null;
  }
}

export function publicPlayer(principal: PlayerPrincipal): PublicPlayer {
  const account = getOgAccountByUsername(principal.username);
  if (!account || account.teamId !== principal.teamId) {
    throw new ApiError(401, "SESSION_EXPIRED", "Phiên đăng nhập đã hết hạn.");
  }
  return {
    role: "player",
    teamId: account.teamId,
    username: account.username,
    name: account.name,
  };
}

export async function setSession(principal: PlayerPrincipal): Promise<void> {
  const value = createSessionToken(principal);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionLifetimeSeconds(),
    priority: "high",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<PlayerPrincipal | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return value ? verifySessionToken(value) : null;
}

export async function requireSession(): Promise<PlayerPrincipal> {
  const principal = await getSession();
  if (!principal) {
    throw new ApiError(401, "SESSION_EXPIRED", "Phiên đăng nhập đã hết hạn.");
  }
  return principal;
}

export const requirePlayerSession = requireSession;

export async function requireOwnTeam(teamId: string): Promise<PlayerPrincipal> {
  const principal = await requireSession();
  if (principal.teamId !== teamId) {
    throw new ApiError(
      403,
      "TEAM_FORBIDDEN",
      "Bạn không được phép xem dữ liệu của OG khác.",
    );
  }
  return principal;
}

export function getPlayerAccount(
  principal: PlayerPrincipal,
): Pick<OgAccount, "username" | "teamId" | "name"> | null {
  const account = getOgAccountByUsername(principal.username);
  return account && account.teamId === principal.teamId
    ? { username: account.username, teamId: account.teamId, name: account.name }
    : null;
}
