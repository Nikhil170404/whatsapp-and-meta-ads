import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { BillingClient } from "./BillingClient";

export default async function WaBillingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.email && session.email === ownerEmail);

  return <BillingClient currentPlan={session.plan_type || "free"} isOwner={isOwner} />;
}
