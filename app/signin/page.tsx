"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, BarChart3, ShieldCheck, Zap, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export default function SignInPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Load Facebook SDK
        if (document.getElementById('facebook-jssdk')) return;
        
        window.fbAsyncInit = function() {
            window.FB.init({
                appId            : process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
                autoLogAppEvents : true,
                xfbml            : true,
                version          : 'v21.0'
            });
        };

        const js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = 'https://connect.facebook.net/en_US/sdk.js';
        js.async = true;
        js.defer = true;
        js.crossOrigin = "anonymous";
        document.body.appendChild(js);
    }, []);

    const handleFacebookLogin = () => {
        setIsLoading(true);
        setError(null);

        // We use the JS SDK Login instead of a hardcoded URL to prevent "Invalid Scopes" and "Redirect URI" errors
        window.FB.login((response: any) => {
            if (response.authResponse) {
                const code = response.authResponse.code;
                exchangeCodeForToken(code);
            } else {
                setIsLoading(false);
                setError("Login cancelled or not authorized.");
            }
        }, {
            // Using the same config as the connect page for consistency
            config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true
        });
    };

    const exchangeCodeForToken = async (code: string) => {
        try {
            const res = await fetch("/api/auth/facebook/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Authentication failed");
            }

            router.push("/wa");
        } catch (err: any) {
            setError(err.message || "Failed to sign in. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#25D366]/5 to-transparent rounded-full blur-3xl" />
            
            <div className="max-w-md w-full relative z-10">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded-2xl bg-[#25D366] flex items-center justify-center text-white shadow-lg shadow-[#25D366]/20">
                            <MessageSquare className="w-6 h-6 fill-current" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">ReplyKaro</span>
                    </Link>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-2xl shadow-slate-200/50">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-center mb-2">
                        Welcome to ReplyKaro
                    </h1>
                    <p className="text-slate-500 font-medium text-center mb-8 text-sm">
                        Sign in to manage your WhatsApp automations and Meta Ads campaigns.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="flex items-center gap-2 p-3 bg-[#25D366]/5 rounded-xl border border-[#25D366]/10">
                            <MessageSquare className="w-4 h-4 text-[#25D366] shrink-0" />
                            <span className="text-xs font-bold text-slate-700">WhatsApp</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-[#1877F2]/5 rounded-xl border border-[#1877F2]/10">
                            <BarChart3 className="w-4 h-4 text-[#1877F2] shrink-0" />
                            <span className="text-xs font-bold text-slate-700">Meta Ads</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 rotate-45" />
                            {error}
                        </div>
                    )}

                    <Button 
                        onClick={handleFacebookLogin}
                        disabled={isLoading}
                        className="w-full h-14 bg-[#1877F2] text-white hover:bg-[#155EC0] rounded-2xl font-bold text-base shadow-lg shadow-[#1877F2]/20 flex items-center justify-center gap-3 transition-all"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                                Continue with Facebook
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </Button>

                    <p className="mt-6 text-xs text-slate-400 font-medium text-center">
                        By continuing, you agree to our <Link href="/terms" className="underline hover:text-slate-600">Terms of Service</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}
