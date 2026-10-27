import { authenticateApiKey } from "@/lib/api/auth";
import { sendBroadcastNow } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";

// Sending a large broadcast takes time; the Railway worker handles scheduled and large sends.
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  return respond(await sendBroadcastNow(auth.supabase, auth.userId, (await params).id));
}
