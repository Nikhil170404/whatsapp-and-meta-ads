import { withUser, reply } from "@/lib/flows/route-helpers";
import { deleteFlow, getFlow, updateFlow } from "@/lib/flows/ops";

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) => withUser(async (db, userId) => reply(await getFlow(db, userId, (await params).id)));

export const PUT = (req: Request, { params }: Ctx) =>
  withUser(async (db, userId) => reply(await updateFlow(db, userId, (await params).id, await req.json().catch(() => ({})))));

export const DELETE = (_req: Request, { params }: Ctx) => withUser(async (db, userId) => reply(await deleteFlow(db, userId, (await params).id)));
