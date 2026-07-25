import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { WaSidebar } from "@/components/wa-dashboard/WaSidebar";

export default async function WaDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  const supabase = getSupabaseAdmin() as any;
  const [{ data: userRow }, { data: waConn }] = await Promise.all([
    supabase.from("users").select("plan_type, display_name, email").eq("id", session.id).maybeSingle(),
    supabase.from("wa_connections").select("display_name, phone_number").eq("user_id", session.id).maybeSingle(),
  ]);
  const planType: string = (userRow?.plan_type || "free").toLowerCase();

  // Prefer the WhatsApp Business verified name over the Facebook account name,
  // since the FB name often reflects the app provider, not the user's business.
  const businessName: string =
    (waConn?.display_name && waConn.display_name !== "WhatsApp Business" && waConn.display_name !== "unknown")
      ? waConn.display_name
      : (userRow?.display_name || session.display_name);

  return (
    <div className="min-h-screen bg-white">
      <WaSidebar user={{ ...session, display_name: businessName }} planType={planType} />
      <main className="lg:pl-72 pt-20 lg:pt-0">
        <div className="p-4 md:p-10 max-w-[1400px] mx-auto min-h-screen has-bottom-tabs lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
