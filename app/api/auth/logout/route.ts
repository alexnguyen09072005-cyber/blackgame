import { clearSession } from "@/lib/server/auth";
import { jsonOk, withApiErrors } from "@/lib/server/http";

export const POST = withApiErrors(async () => {
  await clearSession();
  return jsonOk({ success: true });
});

