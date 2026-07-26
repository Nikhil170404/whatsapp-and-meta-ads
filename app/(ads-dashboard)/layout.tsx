import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { AdsSidebar } from "@/components/ads-dashboard/AdsSidebar";
import { resolveDisplayName } from "@/lib/auth/display-name";

export default async function AdsDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  // Same resolution as the WhatsApp dashboard so both products call the user by
  // their business name rather than the provider's Facebook account name.
  const displayName = await resolveDisplayName(getSupabaseAdmin() as any, session, "User");

  return (
    <div className="min-h-screen bg-white">
      <AdsSidebar user={{ ...session, display_name: displayName }} />
      <main className="lg:pl-72 pt-20 lg:pt-0">
        <div className="p-4 md:p-10 max-w-[1400px] mx-auto min-h-screen has-bottom-tabs lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
