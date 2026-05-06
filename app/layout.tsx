import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navigation } from "@/components/ui/Navigation";
import { cn } from "@/lib/utils";
import Script from "next/script";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.replykaro.in"),
  applicationName: "ReplyKaro",
  title: {
    default: "ReplyKaro — #1 WhatsApp Business & Meta Ads Automation Tool",
    template: "%s | ReplyKaro",
  },
  description:
    "ReplyKaro — India's #1 WhatsApp automation tool. Automate keyword replies, broadcast templates, and Meta Ad comment-to-WhatsApp flows. Scale your business from ₹99/mo ($3/mo).",
  alternates: {
    languages: {
      "en-IN": "https://www.replykaro.in",
      "en": "https://www.replykaro.in",
      "x-default": "https://www.replykaro.in",
    },
    canonical: "https://www.replykaro.in",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
    shortcut: "/favicon.png",
  },
  manifest: "/manifest.json",
  other: {
    "application-name": "ReplyKaro",
    "apple-mobile-web-app-title": "ReplyKaro",
  },
  keywords: [
    "replykaro", "whatsapp automation", "whatsapp business api", "whatsapp bot india",
    "meta ads automation", "facebook ads comment reply", "whatsapp marketing tool",
    "whatsapp auto responder", "whatsapp keyword trigger", "whatsapp broadcast tool",
    "whatsapp automation for small business", "cheapest whatsapp automation",
    "whatsapp automation UPI", "whatsapp tool razorpay",
    "wati alternative", "interakt alternative", "aisensy alternative",
    "respond.io alternative", "whatsapp chatbot india"
  ],
  authors: [{ name: "ReplyKaro" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.replykaro.in",
    siteName: "ReplyKaro",
    title: "ReplyKaro™ — #1 WhatsApp Business & Meta Ads Automation Tool",
    description: "Automate your WhatsApp Business conversations and Meta Ad replies instantly. Scale your business with the cheapest automation tool in India.",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReplyKaro™ — #1 WhatsApp Business & Meta Ads Automation Tool",
    description: "Automate your WhatsApp Business conversations and Meta Ad replies instantly. Cheapest WhatsApp automation starting from ₹99/mo.",
    images: ["/opengraph-image"],
    site: "@HelloReplykaro",
    creator: "@HelloReplykaro",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <JsonLd />
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
