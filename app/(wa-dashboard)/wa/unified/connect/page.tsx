import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ConnectClient } from "./ConnectClient";

export const metadata = { title: "Connect to ReplyKaro Unified – ReplyKaro" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ code?: string; from?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  const { code, from } = await searchParams;
  return <ConnectClient code={code ?? ""} from={from ?? ""} />;
}
