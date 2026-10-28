# Features, claims and payments: what was decided

## Intent
Make every marketing and billing statement match what the product does, add the features small businesses ask for, and keep prices low (customers pay Meta directly, so ReplyKaro's costs are only hosting).

## Research (October 2026)
- Competitors (AiSensy, Interakt, WATI): broadcasts, flow builder, shared inbox, catalog, CRM; chatbots mostly rule-based. All priced above ReplyKaro (AiSensy from about ₹1,500 a month).
- Meta pricing (checked on Meta's pricing page): 1,000 free delivered service messages per number per month; from 1 Oct 2026 service messages after that, and utility templates inside an open chat window, are charged; Click-to-WhatsApp free window is up to 7 days (the site said 72 hours).
- Meta in-chat payments (India): `order_details` message with Razorpay, PayU, BillDesk or Zaakpay. Needs a payment configuration created on the WABA by the business. Docs disagree on the supported gateway list.
- WhatsApp Flows (native forms): Cloud API only, needs a verified business.

## Approaches considered for payments
1. Payment-link block (built): sends a message with a button to the business's own payment link (Razorpay link, UPI page, any gateway). Works for every business today; money never passes through ReplyKaro.
2. Native `order_details` checkout: best experience, but each business must configure a gateway inside Meta first, and we cannot test it without one. Deferred until a customer has a configured gateway.
3. Collect money through ReplyKaro's own gateway account: rejected (ReplyKaro would hold customers' money).

## Done
- "Payment link" flow block (engine, checks, sender, editor, preview) and an "order and get paid" template.
- Plan lists on the landing page, billing page and plan limits now name only features that exist. Removed: priority broadcast queue, advanced segments, multi-campaign, 12-hour support promise, "3 accounts" (one number per account).
- Meta pricing text corrected (landing FAQ, billing card).

- "Send to a URL" flow block: posts the collected details as JSON to the business's own address (Zapier, Make, n8n, Google Sheets, a CRM). Public https only; addresses are checked at connection time so names that point at private networks are refused. Failures never stop the conversation. Editor warns to mention it in the privacy notice (DPDP).
- Message block can carry a picture, a video or a document (PDF price list, brochure), one per message, with caption.
- Website button: copy-paste, script-free WhatsApp button on the Chat link page.
- Already existed (checked, not rebuilt): contact CSV import and export, saved quick replies in the inbox, chat link and QR, scheduled broadcasts, business hours and away message, leads with CSV export, REST API and MCP.

## Not done / next
- Native `order_details` payments, WhatsApp Flows forms, catalog and carousel messages.
- Price changes: left as is (Free, ₹999, ₹1,999), already below competitors. A cheaper entry plan needs a new Razorpay plan id.
- Support response times are not promised until staffed.
