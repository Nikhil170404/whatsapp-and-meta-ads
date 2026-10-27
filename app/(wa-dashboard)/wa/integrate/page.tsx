import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { IntegrateClient } from "./IntegrateClient";
import { isHashedKey } from "@/lib/api/keys";

export const metadata = { title: "Integrate – ReplyKaro" };

export default async function IntegratePage() {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/wa/integrate");

  const supabase = getSupabaseAdmin() as any;
  const { data: keyRow } = await supabase
    .from("wa_api_keys")
    .select("api_key, key_prefix, created_at, last_used_at")
    .eq("user_id", session.id)
    .maybeSingle();

  const hashed = keyRow ? isHashedKey(keyRow.api_key) : false;
  return (
    <IntegrateClient
      initialKey={keyRow && !hashed ? keyRow.api_key : null}
      existingPrefix={hashed ? keyRow.key_prefix ?? "rk_live_…" : null}
      lastUsed={keyRow?.last_used_at ?? null}
    />
  );
}
