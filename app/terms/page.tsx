import { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/ui/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service | ReplyKaro",
  description: "Terms of Service for using ReplyKaro.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#25D366]/20">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-100">
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Terms of Service</h1>
            <p className="text-slate-500 font-medium mb-12">Last Updated: May 2026</p>

            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-[#25D366]">
              <h2>1. Agreement to Terms</h2>
              <p>
                By accessing or using ReplyKaro (the "Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
              </p>

              <h2>2. Description of Service</h2>
              <p>
                ReplyKaro provides WhatsApp Business API and Meta Ads automation tools. We facilitate the connection between your business and Meta's official APIs to allow for automated messaging workflows.
              </p>

              <h2>3. Meta Platforms Compliance</h2>
              <p>
                To use ReplyKaro, you must connect a valid WhatsApp Business Account. By doing so, you agree to comply with:
              </p>
              <ul>
                <li>The WhatsApp Business Terms of Service.</li>
                <li>The Meta Commerce Policies.</li>
                <li>All applicable local laws and regulations regarding user consent and spam.</li>
              </ul>
              <p>
                You are solely responsible for ensuring you have obtained the necessary opt-ins from your customers before sending them automated messages via our platform. 
                ReplyKaro reserves the right to suspend or terminate your account if we detect abusive behavior or violations of Meta's spam policies.
              </p>

              <h2>4. Billing and Meta Conversation Charges</h2>
              <p>
                ReplyKaro charges a flat monthly platform fee for the software. <strong>We do not bill for individual WhatsApp conversation charges.</strong> 
                By using our Embedded Signup flow, your WhatsApp Business Account is billed directly by Meta for all conversation-based pricing. 
                You are responsible for maintaining a valid payment method within your Meta Business Manager to prevent API disruptions.
              </p>

              <h2>5. Limitation of Liability</h2>
              <p>
                In no event shall ReplyKaro, nor its directors, employees, or partners, be liable for any indirect, incidental, special, consequential or punitive damages, 
                including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                We do not guarantee 100% uptime of the Meta Graph API.
              </p>

              <h2>6. Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will notify users of any material changes via email or dashboard notifications.
              </p>

              <h2>7. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at <a href="mailto:aipgl200ok@gmail.com">aipgl200ok@gmail.com</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
