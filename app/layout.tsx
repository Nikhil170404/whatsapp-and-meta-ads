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
  metadataBase: new URL("https://www.replykaro.com"),
  applicationName: "ReplyKaro",
  title: {
    default: "ReplyKaro — #1 Instagram AutoDM & Comment-to-DM Tool | ₹99/mo",
    template: "%s | ReplyKaro",
  },
  description:
    "ReplyKaro — India's #1 Instagram AutoDM tool. Reply karo to every comment & story automatically. Comment-to-DM, keyword triggers, fan loyalty & story automation from ₹99/mo ($3/mo). Free Forever plan. Cheapest ManyChat alternative with UPI. Reply karo, grow karo!",
  alternates: {
    languages: {
      "en-IN": "https://www.replykaro.com",
      "en-US": "https://www.replykaro.com",
      "en-GB": "https://www.replykaro.com",
      "en-CA": "https://www.replykaro.com",
      "en-AU": "https://www.replykaro.com",
      "en": "https://www.replykaro.com",
      "x-default": "https://www.replykaro.com",
    },
    canonical: "https://www.replykaro.com",
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
    // Brand
    "replykaro", "reply karo", "replykaro.com", "reply to karo", "reply kro",
    // Core Product
    "autodm", "auto dm", "instagram auto dm", "instagram auto dm tool",
    "instagram dm automation", "instagram dm automation tool",
    "instagram auto reply", "instagram auto reply tool",
    "instagram dm bot", "instagram chatbot", "instagram chatbot for business",
    "instagram auto responder", "dm karo", "insta karo", "automation karo",
    // Comment-to-DM
    "comment to dm", "comment to dm automation", "comment to dm instagram",
    "instagram comment automation", "auto reply instagram comment",
    "instagram comment to DM automation", "keyword trigger instagram",
    // Story Automation
    "instagram story automation", "instagram story reply automation",
    "auto reply instagram story", "story mention automation",
    // India-Specific
    "instagram automation india", "cheapest instagram automation",
    "99 rs instagram tool", "99 rupees instagram automation",
    "instagram automation UPI", "instagram tool razorpay",
    "cheapest autodm tool india", "indian autodm tool",
    "instagram automation for small business india",
    // Competitor Alternatives
    "manychat alternative", "manychat alternative india",
    "manychat alternative free", "manychat alternative cheap",
    "manychat alternative 2026",
    "creatorflow alternative", "linkdm alternative",
    "grohubz alternative", "chatfuel alternative",
    "wati alternative instagram", "spur alternative",
    "respond.io alternative", "tidio alternative",
    // Feature Keywords
    "instagram follow gate", "fan loyalty instagram",
    "viral reel automation", "instagram engagement engine",
    // Niche
    "instagram automation for creators", "instagram automation for coaches",
    "best instagram automation tools 2026",
    "instagram dm marketing", "instagram lead generation automation",
    "reply to karo explanation", "what is reply to karo",
    // Long-tail
    "cheapest instagram dm automation", "instagram automation without ban",
    "meta verified instagram tool", "instagram automation free forever",
    "affordable Instagram automation",
  ],
  authors: [{ name: "ReplyKaro" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.replykaro.com",
    siteName: "ReplyKaro",
    title: "ReplyKaro™ — #1 Instagram AutoDM & Comment-to-DM Tool | ₹99/mo",
    description: "Reply karo to every comment, story & DM automatically. India's cheapest Instagram automation — Free Forever or ₹99/mo ($3/mo). ManyChat alternative with UPI.",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReplyKaro™ — #1 Instagram AutoDM Tool | ₹99/mo | Reply Karo Automatically",
    description: "Reply karo to every comment & DM automatically. Comment-to-DM, story replies & fan loyalty. Cheapest ManyChat alternative. Free Forever plan. Made in India 🇮🇳",
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
