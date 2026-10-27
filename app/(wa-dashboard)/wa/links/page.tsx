import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { LinksClient } from "./LinksClient";

export const metadata = { title: "Chat link & QR code" };

export default async function LinksPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const { data: connection } = await supabase
    .from("wa_connections")
    .select("phone_number, display_name, status")
    .eq("user_id", session.id)
    .maybeSingle();

  return <LinksClient phoneNumber={connection?.status === "active" ? connection.phone_number : null} businessName={connection?.display_name ?? null} />;
}
