import { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { DataRequestForm } from "./DataRequestForm";

export const metadata: Metadata = {
  title: "Data Rights & Grievance Requests",
  description: "Exercise your rights under India's Digital Personal Data Protection Act 2023: access, correct or erase your data, withdraw consent or raise a grievance with ReplyKaro.",
  alternates: { canonical: "https://www.replykaro.in/data-request" },
};

export default function DataRequestPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#25D366]/20">
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-slate-100">
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Your Data Rights</h1>
            <p className="text-slate-500 font-medium mb-8">
              Under the Digital Personal Data Protection Act, 2023 you can ask us to show, correct or erase your personal data,
              withdraw your consent, or raise a grievance. We respond within 30 days. Read our <Link href="/privacy" className="text-[#25D366] underline">Privacy Policy</Link> for details.
            </p>
            <DataRequestForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
