import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { BillingClient } from "./BillingClient";

export default async function WaBillingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const headersList = await headers();
  const country = headersList.get("x-vercel-ip-country") || "IN";

  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwner = Boolean(ownerEmail && session.email && session.email === ownerEmail);

  return <BillingClient currentPlan={session.plan_type || "free"} isOwner={isOwner} country={country} />;
}
