import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdsSidebar } from "@/components/ads-dashboard/AdsSidebar";

export default async function AdsDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen bg-white">
      <AdsSidebar user={session} />
      <main className="lg:pl-72 pt-20 lg:pt-0">
        <div className="p-4 md:p-10 max-w-[1400px] mx-auto min-h-screen has-bottom-tabs lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
