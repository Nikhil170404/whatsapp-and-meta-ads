import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, Link2, ExternalLink } from "lucide-react";
import Link from "next/link";

export default async function AdsConnectPage() {
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

  const { data: connection } = await supabase
    .from("ad_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Connect Meta Ads</h1>
        <p className="text-slate-500 font-medium mt-1">Link your Facebook account to sync campaigns and automate ad comments.</p>
      </div>

      {connection && connection.status === 'active' ? (
        <div className="bg-white rounded-[2rem] border border-[#1877F2]/20 p-8 shadow-lg shadow-[#1877F2]/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#1877F2]/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-16 h-16 rounded-full bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Connected to Facebook</h2>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1877F2] animate-pulse" />
                Ads API is active
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 relative z-10">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Facebook User ID</p>
              <p className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1877F2]" />
                {connection.fb_user_id}
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ad Account ID</p>
              <p className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#1877F2]" />
                {connection.ad_account_id}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 relative z-10">
            <button className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors text-sm">
              Disconnect Account
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm text-center">
          <div className="w-20 h-20 rounded-3xl bg-[#1877F2]/10 flex items-center justify-center mx-auto mb-6 text-[#1877F2]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 mb-2">Login with Facebook</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Authorize ReplyKaro to access your ad accounts, campaigns, and page comments to enable automations.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-6 text-left mb-8 max-w-md mx-auto border border-slate-100">
            <h4 className="font-bold text-slate-900 mb-3 text-sm">Required Permissions:</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> ads_read</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> pages_show_list</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> pages_read_engagement</li>
            </ul>
          </div>
          
          <a
            href="/api/auth/facebook"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1877F2] text-white rounded-xl font-bold hover:bg-[#155EC0] transition-all shadow-lg shadow-[#1877F2]/20"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Continue with Facebook
          </a>
        </div>
      )}
    </div>
  );
}
