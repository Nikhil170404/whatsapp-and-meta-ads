import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MessageSquare, Search } from "lucide-react";

export default async function WaMessagesPage() {
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

  const { data: messages } = await supabase
    .from("wa_messages")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  // Basic grouping by phone number for the UI mockup
  const conversations = messages?.reduce((acc: any, msg: any) => {
    const phone = msg.direction === 'inbound' ? msg.from_phone : msg.to_phone;
    if (!acc[phone]) acc[phone] = [];
    acc[phone].push(msg);
    return acc;
  }, {});

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Messages</h1>
          <p className="text-slate-500 font-medium mt-1">View your WhatsApp inbound and outbound messages.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex">
        {/* Sidebar - Conversations */}
        <div className="w-80 border-r border-slate-100 flex flex-col">
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {conversations && Object.keys(conversations).length > 0 ? (
              Object.keys(conversations).map((phone, i) => (
                <div key={phone} className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${i === 0 ? 'bg-slate-50/80 border-l-4 border-l-[#25D366]' : ''}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-slate-900 truncate pr-2">{phone}</p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">
                      {new Date(conversations[phone][0].created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{conversations[phone][0].content}</p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                <p className="text-sm">No conversations</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50/30">
          {conversations && Object.keys(conversations).length > 0 ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{Object.keys(conversations)[0]}</h3>
                    <p className="text-xs text-[#25D366] font-medium">WhatsApp Contact</p>
                  </div>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col-reverse">
                {/* Note: reversed mapping for actual implementation, just mocking flow here */}
                {conversations[Object.keys(conversations)[0]].map((msg: any) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl p-4 ${
                      msg.direction === 'outbound' 
                        ? 'bg-[#25D366] text-white rounded-br-none' 
                        : 'bg-white border border-slate-100 shadow-sm rounded-bl-none text-slate-900'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <div className={`text-[10px] font-bold mt-1.5 flex justify-end gap-1 ${
                        msg.direction === 'outbound' ? 'text-[#25D366]-100/80' : 'text-slate-400'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.direction === 'outbound' && <span className="capitalize opacity-80">• {msg.status}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] transition-all"
                  />
                  <button className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#1DA851] transition-colors">
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-6 text-slate-300">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">No messages selected</h2>
              <p className="text-slate-500 max-w-sm">Connect your WhatsApp account to start receiving and replying to messages.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
