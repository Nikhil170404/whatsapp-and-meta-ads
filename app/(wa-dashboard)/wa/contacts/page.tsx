import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContactsClient } from "./ContactsClient";

export default async function WaContactsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

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
