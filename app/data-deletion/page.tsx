import { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/ui/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | ReplyKaro",
  description: "Instructions on how to delete your data and Meta API connections from ReplyKaro.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#25D366]/20">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-100">
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Data Deletion Instructions</h1>
            <p className="text-slate-500 font-medium mb-12">
              According to the Facebook Platform Rules, we have to provide a User Data Deletion Callback URL or Data Deletion Instructions URL. 
              If you want to delete your activities and data associated with ReplyKaro, please follow the instructions below.
            </p>

            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-[#25D366]">
              <h2>Option 1: Delete Data via Facebook Settings</h2>
              <p>You can automatically remove our app's access to your data entirely through your Facebook account settings:</p>
              <ol>
                <li>Go to your Facebook Account's <strong>Settings & Privacy</strong>. Click <strong>Settings</strong>.</li>
                <li>In the left-hand menu, look for <strong>Security and Login</strong> and click <strong>Business Integrations</strong>.</li>
                <li>Search for <strong>"Replykarowa"</strong> (or ReplyKaro).</li>
                <li>Check the box next to our app and click <strong>Remove</strong>.</li>
                <li>In the confirmation popup, you can optionally check the box to "Delete posts, videos or events Replykarowa posted on your timeline".</li>
                <li>Click <strong>Remove</strong>. This completely severs our connection to your Meta account.</li>
              </ol>

              <h2>Option 2: Delete Data via ReplyKaro Dashboard</h2>
              <p>You can instantly delete your WhatsApp API connection data directly from our platform:</p>
              <ol>
                <li>Log in to your <Link href="/signin">ReplyKaro Dashboard</Link>.</li>
                <li>Navigate to the <strong>Connect</strong> tab in the sidebar.</li>
                <li>Click the red <strong>Disconnect Account</strong> button.</li>
                <li>This action instantly deletes your WhatsApp Business Account ID, Phone Number ID, and Access Token from our secure databases.</li>
              </ol>

              <h2>Option 3: Full Account Deletion Request</h2>
              <p>
                If you wish to completely delete your ReplyKaro user account, along with all associated automations, message logs, and billing history, 
                you can contact our Data Protection Officer directly to request a hard deletion.
              </p>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 my-6">
                <p className="m-0"><strong>Email:</strong> <a href="mailto:aipgl200ok@gmail.com">aipgl200ok@gmail.com</a></p>
                <p className="m-0 mt-2"><strong>Subject:</strong> Account & Data Deletion Request</p>
                <p className="m-0 mt-2 text-sm text-slate-500">Please include the email address associated with your ReplyKaro account in the body of the email. We will process all hard-deletion requests within 7 business days.</p>
              </div>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
