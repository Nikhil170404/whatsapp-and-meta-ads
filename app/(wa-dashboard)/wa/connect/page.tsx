import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WaConnectClient } from "./WaConnectClient";

export default async function WaConnectPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: connection } = await supabase
    .from("wa_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Connect WhatsApp</h1>
        <p className="text-slate-500 font-medium mt-1">Link your WhatsApp Business Account to enable API access and automations.</p>
      </div>
      
      <WaConnectClient initialConnection={connection} />
    </div>
  );
}
