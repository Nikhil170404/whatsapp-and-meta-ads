import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Users, Search, Plus, Tag, MessageSquare, Phone } from "lucide-react";

export default async function WaContactsPage() {
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

  // Try to get contacts, fallback to empty array if table doesn't exist yet
  let contacts: any[] = [];
  try {
    const { data } = await supabase
      .from("wa_contacts")
      .select("*")
      .eq("user_id", session.id)
      .order("last_message_at", { ascending: false });
    contacts = data || [];
  } catch {}

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Manage your WhatsApp contacts and conversation history.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20 self-start">
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search contacts by name or phone number..." 
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
        />
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {contacts.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {contacts.map((contact: any) => (
              <div key={contact.id} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-bold text-lg shrink-0">
                    {(contact.display_name || contact.phone_number || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{contact.display_name || contact.phone_number}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {contact.phone_number}
                      </p>
                      <span className="text-xs text-slate-400">
                        {contact.message_count} messages
                      </span>
                    </div>
                    {contact.labels && contact.labels.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {contact.labels.slice(0, 3).map((label: string, li: number) => (
                          <span key={li} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            <Tag className="w-2.5 h-2.5" />
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button className="p-2.5 text-[#25D366] hover:bg-[#25D366]/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100">
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 md:p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-400">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No contacts yet</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm mb-6">When users message your WhatsApp Business number, they'll automatically appear here as contacts.</p>
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20">
              <Plus className="w-4 h-4" />
              Add Contact Manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
