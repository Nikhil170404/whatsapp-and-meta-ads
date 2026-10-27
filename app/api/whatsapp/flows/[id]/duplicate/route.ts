import { withUser, reply } from "@/lib/flows/route-helpers";
import { duplicateFlow } from "@/lib/flows/ops";

export const POST = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withUser(async (db, userId) => reply(await duplicateFlow(db, userId, (await params).id), 201));
