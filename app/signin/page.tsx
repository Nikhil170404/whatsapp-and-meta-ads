"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, BarChart3, AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Check for error in URL from the server-side flow
        const urlError = searchParams.get("error");
        if (urlError) {
            setError(decodeURIComponent(urlError));
        }
    }, [searchParams]);

    const handleFacebookLogin = () => {
        setIsLoading(true);
        setError(null);
        // Redirect to our backend auth route which starts the server-side OAuth flow
        window.location.href = "/api/auth/facebook/login";
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-[#25D366] rounded-2xl flex items-center justify-center shadow-lg shadow-[#25D366]/20 mb-6">
                        <MessageSquare className="w-9 h-9 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        REPLYKARO
                    </h1>
                </div>

                <div className="text-center mb-10">
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
                        Welcome to ReplyKaro
                    </h2>
                    <p className="text-slate-500 font-medium leading-relaxed">
                        Sign in to manage your WhatsApp automations and Meta Ads campaigns.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4 flex flex-col items-center transition-all hover:bg-[#dcfce7]">
                        <MessageSquare className="w-6 h-6 text-[#16a34a] mb-2" />
                        <span className="text-sm font-semibold text-[#166534]">WhatsApp</span>
                    </div>
                    <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-2xl p-4 flex flex-col items-center transition-all hover:bg-[#dbeafe]">
                        <BarChart3 className="w-6 h-6 text-[#2563eb] mb-2" />
                        <span className="text-sm font-semibold text-[#1e40af]">Meta Ads</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-8 p-5 bg-red-50 border border-red-100 rounded-[1.5rem] flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="mt-0.5">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-red-800 leading-snug">
                            {error}
                        </p>
                    </div>
                )}

                <button
                    onClick={handleFacebookLogin}
                    disabled={isLoading}
                    className="w-full bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-70 text-white font-bold py-5 px-8 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-[#1877F2]/20 text-lg group"
                >
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <svg className="w-6 h-6 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                    )}
                    <span>{isLoading ? "Signing in..." : "Continue with Facebook"}</span>
                    {!isLoading && (
                        <span className="ml-1 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">→</span>
                    )}
                </button>

                <p className="mt-10 text-center text-xs text-slate-400 font-medium">
                    By continuing, you agree to our{" "}
                    <Link href="/terms" className="text-[#1877F2] hover:underline">
                        Terms of Service
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
