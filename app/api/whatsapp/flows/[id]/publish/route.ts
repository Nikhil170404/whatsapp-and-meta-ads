import { withUser, reply } from "@/lib/flows/route-helpers";
import { publishFlow, unpublishFlow } from "@/lib/flows/ops";

/** Body: { publish: true } to go live, { publish: false } to take it down. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withUser(async (db, userId) => {
    const { publish } = await req.json().catch(() => ({ publish: true }));
    const id = (await params).id;
    return reply(publish === false ? await unpublishFlow(db, userId, id) : await publishFlow(db, userId, id));
  });
