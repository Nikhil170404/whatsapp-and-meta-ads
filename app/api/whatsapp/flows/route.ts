import { withUser, reply } from "@/lib/flows/route-helpers";
import { createFlow, listFlows } from "@/lib/flows/ops";

export const GET = () => withUser(async (db, userId) => reply(await listFlows(db, userId)));

export const POST = (req: Request) =>
  withUser(async (db, userId) => reply(await createFlow(db, userId, await req.json().catch(() => ({}))), 201));
