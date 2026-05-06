import { env } from "@/lib/env";

const FB_API_URL = "https://graph.facebook.com/v21.0";

export async function getAdAccounts(accessToken: string) {
  const response = await fetch(`${FB_API_URL}/me/adaccounts?fields=name,account_id,account_status`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta Ads API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function getCampaigns(adAccountId: string, accessToken: string) {
  // Wait, adAccountId typically starts with act_ in API requests, so we need to ensure it has it or not.
  // The API expects act_<ACCOUNT_ID>
  const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const response = await fetch(
    `${FB_API_URL}/${formattedAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta Ads API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function getCampaignInsights(campaignId: string, accessToken: string) {
  const response = await fetch(
    `${FB_API_URL}/${campaignId}/insights?fields=impressions,clicks,spend,ctr&date_preset=maximum`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta Ads API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}
