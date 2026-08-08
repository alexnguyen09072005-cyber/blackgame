import {
  authenticatePlayer,
  publicPlayer,
  setSession,
} from "@/lib/server/auth";
import { ApiError, jsonOk, readJson, withApiErrors } from "@/lib/server/http";
import { enforceLoginRateLimit } from "@/lib/server/login-rate-limit";
import { z } from "zod";

const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(32),
    password: z.string().min(1).max(256),
  })
  .strict();

export const POST = withApiErrors(async (request: Request) => {
  await enforceLoginRateLimit(request);
  const { username, password } = await readJson(request, loginSchema);
  const principal = authenticatePlayer(username, password);
  if (!principal) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Tên đăng nhập hoặc mật khẩu không đúng.",
    );
  }
  await setSession(principal);
  return jsonOk({ user: publicPlayer(principal) });
});
