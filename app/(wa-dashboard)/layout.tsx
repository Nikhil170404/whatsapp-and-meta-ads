import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { WaSidebar } from "@/components/wa-dashboard/WaSidebar";
import { resolveDisplayName } from "@/lib/auth/display-name";

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
  const [{ data: userRow }, businessName] = await Promise.all([
    supabase.from("users").select("plan_type").eq("id", session.id).maybeSingle(),
    resolveDisplayName(supabase, session, "User"),
  ]);
  const planType: string = (userRow?.plan_type || "free").toLowerCase();

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
