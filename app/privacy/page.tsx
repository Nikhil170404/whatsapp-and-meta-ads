import { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/ui/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | ReplyKaro",
  description: "Privacy Policy for ReplyKaro WhatsApp and Meta Ads automation services.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#25D366]/20">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-100">
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Privacy Policy</h1>
            <p className="text-slate-500 font-medium mb-12">Last Updated: May 2026</p>

            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-[#25D366]">
              <h2>1. Introduction</h2>
              <p>
                Welcome to ReplyKaro ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. 
                This Privacy Policy explains how we collect, use, and share information when you use our website (replykaro.in) and our WhatsApp Business API automation services.
              </p>

              <h2>2. Data Collection via Meta Technologies</h2>
              <p>
                ReplyKaro utilizes Meta technologies, specifically <strong>Facebook Login for Business</strong> and the <strong>WhatsApp Business Platform (Cloud API)</strong>, to provide our automation services. 
                When you connect your WhatsApp Business Account to ReplyKaro via our Embedded Signup flow, we collect the following information provided by Meta:
              </p>
              <ul>
                <li><strong>Profile Information:</strong> Your Facebook User ID, Name, and Email Address.</li>
                <li><strong>WhatsApp Data:</strong> Your WhatsApp Business Account (WABA) ID, Phone Number ID, and Display Phone Number.</li>
                <li><strong>Messaging Data:</strong> Webhook events containing incoming text messages, timestamps, and delivery statuses required to trigger your configured auto-replies.</li>
              </ul>

              <h2>3. How We Use Your Data</h2>
              <p>We use the data collected strictly for the following purposes:</p>
              <ul>
                <li>To authenticate you securely using Facebook Login.</li>
                <li>To register your phone number and configure webhooks on the WhatsApp Cloud API.</li>
                <li>To read incoming messages and automatically send replies based on the automation rules you define in our dashboard.</li>
                <li>To provide customer support and service updates.</li>
              </ul>

              <h2>4. Data Sharing and Third Parties</h2>
              <p>
                <strong>We do not sell, rent, or trade your personal data or your customers' data to third parties.</strong>
              </p>
              <p>
                Data is only shared with third-party service providers (such as hosting platforms or database providers) strictly necessary to operate our service. 
                All data transmitted between ReplyKaro and the Meta Graph API is securely encrypted.
              </p>

              <h2>5. Your Data Rights & Deletion</h2>
              <p>
                You have the right to access, modify, or delete your personal data. If you wish to revoke our access to your Meta account or delete your data entirely from our servers, 
                please visit our <Link href="/data-deletion">Data Deletion Instructions</Link> page.
              </p>

              <h2>6. Contact Us</h2>
              <p>
                If you have any questions or concerns regarding this Privacy Policy, or if you need to contact our Data Protection Officer, please reach out to us at:
              </p>
              <p>
                <strong>Email:</strong> <a href="mailto:aipgl200ok@gmail.com">aipgl200ok@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
