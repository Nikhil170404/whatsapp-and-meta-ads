import { Metadata } from "next";

export const metadata: Metadata = {
  title: "WhatsApp Business Automation | ReplyKaro",
  description:
    "Automate WhatsApp Business with keyword auto-replies, bulk template broadcasts, contact CRM, and opt-in management — on the official Meta Cloud API. Plans from ₹999/mo.",
  alternates: {
    canonical: "https://www.replykaro.in/whatsapp",
    languages: {
      "en-IN": "https://www.replykaro.in/whatsapp",
      "en": "https://www.replykaro.in/whatsapp",
    },
  },
  keywords: [
    "whatsapp automation india",
    "whatsapp business api tool",
    "whatsapp auto reply",
    "whatsapp broadcast messages",
    "whatsapp keyword trigger",
    "whatsapp crm",
    "wati alternative",
    "aisensy alternative",
    "whatsapp chatbot india",
    "replykaro whatsapp",
  ],
  openGraph: {
    type: "website",
    url: "https://www.replykaro.in/whatsapp",
    title: "WhatsApp Business Automation — ReplyKaro",
    description:
      "Set up keyword auto-replies, bulk broadcasts, and a full contact CRM on WhatsApp in 5 minutes. 60% cheaper than WATI. Official Meta API.",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsApp Automation — ReplyKaro",
    description:
      "Auto-replies, broadcasts & CRM on WhatsApp. Official Meta API. Plans from ₹999/mo.",
    images: ["/opengraph-image"],
    site: "@HelloReplykaro",
  },
};

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#25D366]/5 min-h-screen">{children}</div>;
}
