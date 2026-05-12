import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MessagesClient } from "./MessagesClient";

export default async function WaMessagesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const { data: messages } = await supabase
    .from("wa_messages")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return <MessagesClient initialMessages={messages ?? []} />;
}
