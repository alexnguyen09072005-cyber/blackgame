import { publicPlayerCases } from "@/app/api/player/_shared";
import { jsonOk, withApiErrors } from "@/lib/server/http";

export const GET = withApiErrors(async () => {
  // Explicit allowlist serializer prevents secret fields leaking.
  return jsonOk({ cases: publicPlayerCases() });
});
