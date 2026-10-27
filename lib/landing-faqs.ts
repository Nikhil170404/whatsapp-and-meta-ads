// Shared by the visible FAQ and the FAQPage structured data, which must match.
export const FAQS = [
  { q: "Is this the official WhatsApp API?", a: "Yes. ReplyKaro runs on Meta's official WhatsApp Business Cloud API. We do not use WhatsApp Web bots or other unofficial tools, which are the main cause of bans." },
  { q: "Can I use my current WhatsApp number?", a: "You need a WhatsApp Business Account linked to Meta Business Manager. If you do not have one, setup guides you through it. Numbers already on the WhatsApp Business app can be migrated." },
  { q: "What does Meta charge, and who pays it?", a: "You pay Meta directly, at Meta's own rates, with no markup from us. Your ReplyKaro plan covers the software only. Meta charges per delivered template message (marketing is the most expensive, utility and authentication cost less). Each WhatsApp number gets 1,000 free service replies a month; replies beyond that are charged. Customer messages to you are always free, and conversations that start from a Click-to-WhatsApp ad are free for 72 hours. Add a payment method in Meta Business Manager so delivery is never interrupted." },
  { q: "Who can I send broadcasts to?", a: "Only contacts who have agreed to receive your messages. ReplyKaro asks you to confirm consent when you add contacts, sends promotional templates only to contacts who agreed to promotions, and honours STOP instantly." },
  { q: "Do you offer refunds?", a: "Yes. If paid plans are not right for you, ask within 7 days for a full refund. You can cancel anytime from settings." },
  { q: "Where is my data stored and can I delete it?", a: "Data is stored in a managed Postgres database. You can export or delete contacts any time, and your customers can use the data rights page to request access or erasure." },
];
