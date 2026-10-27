import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { addContact, listContacts, setContactConsent } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const u = new URL(req.url).searchParams;
  return respond(await listContacts(auth.supabase, auth.userId, {
    search: u.get("search") ?? undefined, label: u.get("label") ?? undefined, limit: Number(u.get("limit")) || undefined,
  }), (contacts) => ({ contacts }));
}

/** Add a contact. The caller must confirm the person agreed to be messaged. */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  return respond(await addContact(auth.supabase, auth.userId, { ...body, consent_confirmed: body.consent_confirmed === true, consent_source: "api" }), (contact) => ({ contact }), 201);
}

/** Opt a contact out of, or back in to, messages: { phone_number, opted_in }. */
export async function PATCH(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.phone_number || typeof body.opted_in !== "boolean") {
    return NextResponse.json({ error: "Send phone_number and opted_in (true or false)." }, { status: 400 });
  }
  return respond(await setContactConsent(auth.supabase, auth.userId, body.phone_number, body.opted_in, body.consent_purposes));
}
