import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { ContactsClient } from "./ContactsClient";

const PAGE_SIZE = 100;

export default async function WaContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; label?: string; page?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const { q = "", label = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const search = q.replace(/[%,()]/g, " ").trim();

  const supabase = getSupabaseAdmin() as any;

  // One page at a time, filtered and counted by the database. Loading every contact would be
  // silently cut off at 1,000 rows and get slower with every contact added.
  let query = supabase
    .from("wa_contacts")
    .select("*", { count: "exact" })
    .eq("user_id", session.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (label) query = query.contains("labels", [label]);
  if (search) query = query.or(`phone_number.ilike.%${search}%,display_name.ilike.%${search}%`);

  const [{ data: contacts, count }, { data: labels }] = await Promise.all([
    query,
    supabase.rpc("distinct_contact_labels", { p_user: session.id }),
  ]);

  return (
    <ContactsClient
      initialContacts={contacts ?? []}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      labels={Array.isArray(labels) ? labels : []}
      query={q}
      activeLabelParam={label}
    />
  );
}
