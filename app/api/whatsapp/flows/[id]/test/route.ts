import { withUser, reply } from "@/lib/flows/route-helpers";
import { testOnWhatsApp } from "@/lib/flows/ops";

/** Body: { phone }. Runs the published flow on a real phone (needs an open 24-hour window). */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withUser(async (db, userId) => {
    const { phone } = await req.json().catch(() => ({ phone: "" }));
    return reply(await testOnWhatsApp(db, userId, (await params).id, String(phone ?? "")));
  });
