import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FileText, Plus, CheckCircle2, Clock, XCircle } from "lucide-react";

export default async function WaTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
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

  const { data: templates } = await supabase
    .from("wa_templates")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Message Templates</h1>
          <p className="text-slate-500 font-medium mt-1">Manage and submit WhatsApp message templates for Meta approval.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20">
          <Plus className="w-5 h-5" />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates && templates.length > 0 ? (
          templates.map((tpl: any) => (
            <div key={tpl.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <FileText className="w-5 h-5" />
                </div>
                
                {tpl.status === 'approved' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </span>
                )}
                {tpl.status === 'pending' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" /> Pending
                  </span>
                )}
                {tpl.status === 'rejected' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                    <XCircle className="w-3.5 h-3.5" /> Rejected
                  </span>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1">{tpl.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{tpl.category} • {tpl.language}</p>
              
              <div className="bg-slate-50 rounded-xl p-4 flex-1 mb-4">
                <p className="text-sm text-slate-600 font-medium break-words">
                  {tpl.body_text}
                </p>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button className="text-sm font-bold text-[#25D366] hover:text-[#1DA851]">Edit</button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-16 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No templates found</h3>
            <p className="text-slate-500 max-w-md mx-auto">Templates are required for initiating outbound marketing and utility messages to users.</p>
          </div>
        )}
      </div>
    </div>
  );
}
