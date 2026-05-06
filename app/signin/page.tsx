"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
    const handleFacebookLogin = () => {
        const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        const redirectUri = `${window.location.origin}/api/auth/facebook/callback`;
        const scope = "public_profile,email,whatsapp_business_management,whatsapp_business_messaging";
        
        window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl shadow-slate-200/50 text-center">
                <div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center text-[#25D366] mx-auto mb-6">
                    <MessageSquare className="w-8 h-8 fill-[#25D366]" />
                </div>
                
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">ReplyKaro WhatsApp</h1>
                <p className="text-slate-500 font-medium mb-8">Connect your official WhatsApp Business account to start automating.</p>

                <Button 
                    onClick={handleFacebookLogin}
                    className="w-full h-14 bg-[#25D366] text-white hover:bg-[#1DA851] rounded-2xl font-bold text-lg shadow-lg shadow-[#25D366]/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                    Continue with Facebook
                    <ArrowRight className="w-5 h-5" />
                </Button>

                <p className="mt-8 text-xs text-slate-400 font-medium">
                    By continuing, you agree to our <Link href="/terms" className="underline hover:text-slate-600">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
                </p>
            </div>
        </div>
    );
}
