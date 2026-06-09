import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { ContactsClient } from "./ContactsClient";

export default async function WaContactsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  let contacts: any[] = [];
  try {
    const { data } = await supabase
      .from("wa_contacts")
      .select("*")
      .eq("user_id", session.id)
      .order("last_message_at", { ascending: false });
    contacts = data || [];
  } catch {}

  return <ContactsClient initialContacts={contacts} />;
}
