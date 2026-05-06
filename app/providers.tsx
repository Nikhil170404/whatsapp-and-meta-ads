"use client";

import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

export function Providers({ children }: { children: React.ReactNode }) {
  const GA_MEASUREMENT_ID = "G-P9BDP7Q4G9"; 

  return (
    <>
      {/* Google Analytics 4 */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      {children}
      <Toaster position="top-right" richColors />
      <Analytics />
    </>
  );
}
