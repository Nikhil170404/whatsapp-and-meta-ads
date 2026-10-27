import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { listFlows } from "@/lib/flows/ops";
import { FlowsClient } from "./FlowsClient";

export const metadata = { title: "Conversation flows" };

export default async function FlowsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");
  const res = await listFlows(getSupabaseAdmin() as any, session.id);
  return <FlowsClient initial={res.ok ? res.data : []} loadError={res.ok ? null : res.error} />;
}
