"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, BarChart3, ShieldCheck, Zap, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
    const handleFacebookLogin = () => {
        const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        const redirectUri = `${window.location.origin}/api/auth/facebook/callback`;
        const scope = "public_profile,email,whatsapp_business_management,whatsapp_business_messaging,pages_show_list,pages_read_engagement,ads_read,business_management";
        
        window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#25D366]/5 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#1877F2]/5 to-transparent rounded-full blur-3xl" />
            
            <div className="max-w-md w-full relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded-2xl bg-[#25D366] flex items-center justify-center text-white shadow-lg shadow-[#25D366]/20 group-hover:scale-110 transition-transform">
                            <MessageSquare className="w-6 h-6 fill-current" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">ReplyKaro</span>
                    </Link>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-2xl shadow-slate-200/50">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-center mb-2">
                        Welcome to ReplyKaro
                    </h1>
                    <p className="text-slate-500 font-medium text-center mb-8 text-sm">
                        Sign in to manage your WhatsApp automations and Meta Ads campaigns.
                    </p>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="flex items-center gap-2 p-3 bg-[#25D366]/5 rounded-xl border border-[#25D366]/10">
                            <MessageSquare className="w-4 h-4 text-[#25D366] shrink-0" />
                            <span className="text-xs font-bold text-slate-700">WhatsApp Automation</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-[#1877F2]/5 rounded-xl border border-[#1877F2]/10">
                            <BarChart3 className="w-4 h-4 text-[#1877F2] shrink-0" />
                            <span className="text-xs font-bold text-slate-700">Meta Ads Manager</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-700">Auto Replies</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-700">Official Meta API</span>
                        </div>
                    </div>

                    {/* Facebook Login Button */}
                    <Button 
                        onClick={handleFacebookLogin}
                        className="w-full h-14 bg-[#1877F2] text-white hover:bg-[#155EC0] rounded-2xl font-bold text-base shadow-lg shadow-[#1877F2]/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Continue with Facebook
                        <ArrowRight className="w-5 h-5" />
                    </Button>

                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        One login for WhatsApp + Meta Ads
                    </div>

                    <p className="mt-6 text-xs text-slate-400 font-medium text-center">
                        By continuing, you agree to our <Link href="/terms" className="underline hover:text-slate-600">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
                    </p>
                </div>

                {/* Bottom tagline */}
                <p className="text-center mt-6 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Meta Official API Partner • 256-bit Encrypted
                </p>
            </div>
        </div>
    );
}
