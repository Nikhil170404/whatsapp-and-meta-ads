import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { getFlow, otherKeywords } from "@/lib/flows/ops";
import { EditorLoader } from "./EditorLoader";

export const metadata = { title: "Flow editor" };

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  const { id } = await params;
  const db = getSupabaseAdmin() as any;
  const flow = await getFlow(db, session.id, id);
  if (!flow.ok) notFound();
  const { published_definition, ...rest } = flow.data;
  return <EditorLoader flow={rest} otherKeywords={await otherKeywords(db, session.id, id)} />;
}
