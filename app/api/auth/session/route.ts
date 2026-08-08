import { getSession, publicPlayer } from "@/lib/server/auth";
import { jsonOk, withApiErrors } from "@/lib/server/http";

export const GET = withApiErrors(async () => {
  const principal = await getSession();
  return jsonOk({ user: principal ? publicPlayer(principal) : null });
});
