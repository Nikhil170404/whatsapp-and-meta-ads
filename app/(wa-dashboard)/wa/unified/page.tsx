import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { UnifiedLinkClient } from "./UnifiedLinkClient";

export const metadata = { title: "Connect to ReplyKaro Unified – ReplyKaro" };

export default async function UnifiedLinkPage() {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/wa/unified");
  return <UnifiedLinkClient />;
}
