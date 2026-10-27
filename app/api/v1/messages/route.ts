import { authenticateApiKey } from "@/lib/api/auth";
import { listMessages } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const u = new URL(req.url).searchParams;
  return respond(await listMessages(auth.supabase, auth.userId, { phone: u.get("phone") ?? undefined, limit: Number(u.get("limit")) || undefined }), (messages) => ({ messages }));
}
