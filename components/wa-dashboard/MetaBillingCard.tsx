import { ExternalLink, Info, Wallet } from "lucide-react";

const META_PAYMENT_URL = "https://business.facebook.com/billing_hub/payment_settings";
const META_RATES_URL = "https://developers.facebook.com/docs/whatsapp/pricing";

/**
 * Explains the billing split: ReplyKaro charges for the software, Meta charges
 * the business directly for delivered template messages. No credits to top up.
 */
export function MetaBillingCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6" aria-labelledby="meta-billing-title">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="meta-billing-title" className="text-base font-bold text-slate-900">Message fees are paid to Meta, not to us</h2>
          <p className="mt-1 text-sm text-slate-600">
            There are no credits to buy here. WhatsApp bills your Meta account directly, at Meta&apos;s own rates, and we add no markup.
          </p>
        </div>
      </div>

      {!compact && (
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Free", "Messages customers send you, and the first 1,000 delivered service messages each month for each WhatsApp number. Chats started from a Click-to-WhatsApp ad have a free window of up to 7 days."],
            ["Charged by Meta", "Template messages (marketing, utility and authentication), and from 1 October 2026 service replies after the first 1,000 a month and utility templates sent inside an open chat window, per delivered message. Check Meta's pricing page for your country's rates."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-slate-50 p-4">
              <dt className="font-semibold text-slate-900">{t}</dt>
              <dd className="mt-1 text-slate-600">{d}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <a href={META_PAYMENT_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1DA851]">
          Add or check payment method <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
        <a href={META_RATES_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
          See Meta&apos;s rates <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Without a payment method, Meta stops delivering chargeable messages. India accounts must also be billed in INR by 31 December 2026.
      </p>
    </section>
  );
}
