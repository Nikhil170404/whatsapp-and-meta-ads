import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");
  const { data, count } = await (getSupabaseAdmin() as any).from("wa_leads").select("*", { count: "exact" }).eq("user_id", session.id).order("created_at", { ascending: false }).limit(100);
  const leads: any[] = data ?? [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">People who shared their details in a conversation flow. {count ?? 0} in total.</p>
        </div>
        {leads.length > 0 && <a href="/api/whatsapp/leads/export" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Download className="h-4 w-4" aria-hidden /> Download CSV</a>}
      </div>
      {leads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-base font-bold text-slate-800">No leads yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Add a Save lead block to a flow. Customers who reach it will appear here.</p>
          <Link href="/wa/flows" className="mt-4 inline-block rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1fb857]">Open flows</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Flow</th><th className="px-4 py-3">Date</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{l.name || "—"}</td><td className="px-4 py-3 tabular-nums text-slate-700">+{l.phone}</td>
                  <td className="px-4 py-3 text-slate-700">{l.email || "—"}</td><td className="px-4 py-3 text-slate-500">{l.flow_name || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
