import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { BillingClient } from "./BillingClient";

export default async function WaBillingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  return <BillingClient currentPlan={session.plan_type || "free"} />;
}
