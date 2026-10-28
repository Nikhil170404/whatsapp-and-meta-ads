import type { FlowDefinition, FlowSettings } from "./types";

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  settings: FlowSettings;
  definition: FlowDefinition;
}

const n = (id: string, type: any, x: number, y: number, data: any) => ({ id, type, position: { x, y }, data });
const e = (source: string, sourceHandle: string, target: string) => ({ id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target });
const exits = ["cancel", "exit", "quit"];

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "lead-capture",
    name: "Capture a lead",
    description: "Greet, ask for a name and email, learn what they need, save the lead.",
    settings: { trigger_type: "keyword", keywords: ["enquiry", "contact us"], exit_keywords: exits },
    definition: {
      nodes: [
        n("start", "start", 0, 0, {}),
        n("m1", "message", 0, 130, { text: "Hi {{contact_name}}! 👋 Thanks for contacting us. I'll ask two quick questions so the right person can help you." }),
        n("q1", "question", 0, 300, { text: "What's your name?", variable: "name", input: "name", maxRetries: 2 }),
        n("q2", "question", 0, 470, { text: "Thanks {{name}}! What's your email address?", variable: "email", input: "email", maxRetries: 2, skippable: true }),
        n("b1", "buttons", 0, 650, { text: "What do you need help with?", buttons: [{ id: "b_price", title: "Pricing" }, { id: "b_demo", title: "Book a demo" }, { id: "b_other", title: "Something else" }], variable: "interest", maxRetries: 2 }),
        n("lead", "lead", 0, 860, { note: "Lead from WhatsApp" }),
        n("m2", "message", 0, 1000, { text: "Perfect, {{name}}. We've noted your interest in “{{interest}}” and will message you shortly. Reply any time. 🙏" }),
        n("end", "end", 0, 1160, {}),
      ],
      edges: [
        e("start", "next", "m1"), e("m1", "next", "q1"), e("q1", "next", "q2"), e("q2", "next", "b1"),
        e("b1", "btn:b_price", "lead"), e("b1", "btn:b_demo", "lead"), e("b1", "btn:b_other", "lead"),
        e("lead", "next", "m2"), e("m2", "next", "end"),
      ],
    },
  },
  {
    id: "faq-menu",
    name: "FAQ menu with a person on hand",
    description: "A tap-to-choose menu of answers, with a way to reach a real person.",
    settings: { trigger_type: "welcome", keywords: [], exit_keywords: exits },
    definition: {
      nodes: [
        n("start", "start", 200, 0, {}),
        n("menu", "buttons", 200, 140, { text: "Welcome! How can we help today?", buttons: [{ id: "b_hours", title: "Opening hours" }, { id: "b_price", title: "Prices" }, { id: "b_person", title: "Talk to a person" }], maxRetries: 2 }),
        n("hours", "message", 0, 360, { text: "We're open Monday to Saturday, 10 AM to 7 PM." }),
        n("price", "message", 200, 360, { text: "Our plans start at ₹499. Reply with the product name for details." }),
        n("person", "handoff", 420, 360, { text: "Thanks! A team member will reply here shortly.", note: "Asked for a person from the FAQ menu" }),
        n("end", "end", 100, 520, { text: "Anything else? Just say hi to open the menu again." }),
      ],
      edges: [
        e("start", "next", "menu"), e("menu", "btn:b_hours", "hours"), e("menu", "btn:b_price", "price"), e("menu", "btn:b_person", "person"),
        e("hours", "next", "end"), e("price", "next", "end"),
      ],
    },
  },
  {
    id: "appointment",
    name: "Appointment request",
    description: "Choose a service, collect a preferred time and contact details, hand to your team.",
    settings: { trigger_type: "keyword", keywords: ["book", "appointment"], exit_keywords: exits },
    definition: {
      nodes: [
        n("start", "start", 0, 0, {}),
        n("svc", "list", 0, 140, { text: "Which service would you like to book?", buttonLabel: "View services", rows: [{ id: "r_a", title: "Consultation", description: "30 minutes" }, { id: "r_b", title: "Follow-up visit" }, { id: "r_c", title: "Something else" }], variable: "service", maxRetries: 2 }),
        n("when", "question", 0, 340, { text: "When would you like to come? For example: Friday 4 PM.", variable: "preferred_time", input: "text", maxRetries: 2 }),
        n("name", "question", 0, 510, { text: "And your name, please?", variable: "name", input: "name", maxRetries: 2 }),
        n("lead", "lead", 0, 680, { note: "Appointment request" }),
        n("tag", "tag", 0, 810, { label: "appointment" }),
        n("hand", "handoff", 0, 940, { text: "Thanks {{name}}! We'll confirm your {{service}} for {{preferred_time}} here shortly.", note: "Confirm appointment" }),
      ],
      edges: [
        e("start", "next", "svc"), e("svc", "row:r_a", "when"), e("svc", "row:r_b", "when"), e("svc", "row:r_c", "when"),
        e("when", "next", "name"), e("name", "next", "lead"), e("lead", "next", "tag"), e("tag", "next", "hand"),
      ],
    },
  },
  {
    id: "feedback",
    name: "Quick feedback",
    description: "Ask for a rating, then ask unhappy customers what went wrong.",
    settings: { trigger_type: "keyword", keywords: ["feedback"], exit_keywords: exits },
    definition: {
      nodes: [
        n("start", "start", 160, 0, {}),
        n("rate", "buttons", 160, 130, { text: "How was your experience with us?", buttons: [{ id: "b_great", title: "Great" }, { id: "b_ok", title: "Okay" }, { id: "b_bad", title: "Not good" }], variable: "rating", maxRetries: 2 }),
        n("thanks", "message", 0, 340, { text: "Thank you! We're glad you had a good experience. 🌟" }),
        n("why", "question", 320, 340, { text: "Sorry to hear that. What went wrong?", variable: "complaint", input: "text", maxRetries: 1, skippable: true }),
        n("tag", "tag", 320, 520, { label: "needs follow-up" }),
        n("lead", "lead", 320, 650, { note: "Unhappy customer" }),
        n("hand", "handoff", 320, 780, { text: "Thank you for telling us. Someone from our team will contact you.", note: "Follow up on complaint" }),
        n("end", "end", 0, 520, {}),
      ],
      edges: [
        e("start", "next", "rate"), e("rate", "btn:b_great", "thanks"), e("rate", "btn:b_ok", "thanks"), e("rate", "btn:b_bad", "why"),
        e("thanks", "next", "end"), e("why", "next", "tag"), e("tag", "next", "lead"), e("lead", "next", "hand"),
      ],
    },
  },
  {
    id: "order-and-pay",
    name: "Take an order and get paid",
    description: "Show what you sell, ask for a name, then send a payment button. Paste your own payment link before publishing.",
    settings: { trigger_type: "keyword", keywords: ["order", "buy"], exit_keywords: exits },
    definition: {
      nodes: [
        n("start", "start", 160, 0, {}),
        n("menu", "list", 160, 130, { text: "What would you like to order?", buttonLabel: "See items", rows: [{ id: "r_a", title: "Item A", description: "Edit the name and price" }, { id: "r_b", title: "Item B", description: "Edit the name and price" }, { id: "r_c", title: "Something else" }], variable: "item", maxRetries: 2 }),
        n("name", "question", 160, 380, { text: "Great choice. What name should we put on the order?", variable: "name", input: "name", maxRetries: 2 }),
        n("addr", "question", 160, 520, { text: "Where should we deliver it? Send the full address.", variable: "address", input: "text", maxRetries: 1 }),
        n("pay", "pay", 160, 660, { text: "Thanks {{name}}! To confirm your {{item}}, please pay using the button below.", url: "", buttonLabel: "Pay now" }),
        n("lead", "lead", 160, 800, { note: "Order started" }),
        n("hand", "handoff", 160, 930, { text: "Once your payment arrives we will confirm your order here.", note: "Check payment and confirm order" }),
        n("other", "handoff", 440, 380, { text: "Sure. A team member will help you with that shortly.", note: "Custom order request" }),
      ],
      edges: [
        e("start", "next", "menu"), e("menu", "row:r_a", "name"), e("menu", "row:r_b", "name"), e("menu", "row:r_c", "other"),
        e("name", "next", "addr"), e("addr", "next", "pay"), e("pay", "next", "lead"), e("lead", "next", "hand"),
      ],
    },
  },
];

export const blankFlow = (): { settings: FlowSettings; definition: FlowDefinition } => ({
  settings: { trigger_type: "keyword", keywords: [], exit_keywords: exits },
  definition: { nodes: [n("start", "start", 0, 0, {}) as any], edges: [] },
});
