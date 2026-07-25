import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meta Ads Automation — Click-to-WhatsApp & Comment DM | ReplyKaro",
  description:
    "Automate Meta ad campaigns with Click-to-WhatsApp (CTWA), auto-reply to ad comments via DM, and track leads in real time. Built on official Meta Marketing API.",
  alternates: {
    canonical: "https://www.replykaro.in/meta-ads",
    languages: {
      "en-IN": "https://www.replykaro.in/meta-ads",
      "en": "https://www.replykaro.in/meta-ads",
    },
  },
  keywords: [
    "meta ads automation",
    "click to whatsapp ads",
    "ctwa india",
    "facebook ads comment auto reply",
    "meta marketing api",
    "whatsapp ad leads",
    "facebook comment to dm",
    "meta ads whatsapp integration",
    "replykaro meta ads",
  ],
  openGraph: {
    type: "website",
    url: "https://www.replykaro.in/meta-ads",
    title: "Meta Ads Automation — ReplyKaro",
    description:
      "Convert ad clicks directly to WhatsApp conversations. Auto-reply to Facebook & Instagram ad comments. Track every lead in real time.",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta Ads Automation — ReplyKaro",
    description:
      "CTWA campaigns, comment-to-DM automation & real-time lead tracking. Official Meta Marketing API.",
    images: ["/opengraph-image"],
    site: "@HelloReplykaro",
  },
};

export default function MetaAdsLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#1877F2]/5 min-h-screen">{children}</div>;
}
