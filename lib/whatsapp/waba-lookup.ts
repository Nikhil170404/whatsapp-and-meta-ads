const WA_API_URL = "https://graph.facebook.com/v25.0";

export interface WabaLookupResult {
  wabaId: string | null;
  phoneNumberId: string | null;
  /** Human-readable trace of what each Meta endpoint returned — surfaced in the UI on failure. */
  diagnostics: string[];
}

/**
 * Resolves the WhatsApp Business Account ID and phone number ID for a user access
 * token obtained from Embedded Signup.
 *
 * The authoritative source is the /debug_token endpoint, which returns
 * `data.granular_scopes` listing exactly which WABAs and phone numbers the user
 * granted the app access to. This is the only method that works for every account
 * type — /me/whatsapp_business_accounts returns an empty list for System Users and
 * for business admins whose WABA is owned by a Business Portfolio rather than by
 * their personal Facebook account.
 *
 * See: https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/
 */
export async function resolveWabaFromToken(
  userToken: string,
  appId: string,
  appSecret: string
): Promise<WabaLookupResult> {
  const diagnostics: string[] = [];
  let wabaId: string | null = null;
  let phoneNumberId: string | null = null;

  // 1. debug_token — authoritative. granular_scopes is nested under `data`.
  try {
    const appToken = `${appId}|${appSecret}`;
    const res = await fetch(
      `${WA_API_URL}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appToken)}`
    );
    const json = await res.json();

    if (json?.error) {
      diagnostics.push(`debug_token error: ${json.error.message}`);
    } else {
      const scopes = json?.data?.granular_scopes || [];
      if (scopes.length === 0) {
        diagnostics.push("debug_token returned no granular_scopes (token has no business assets attached).");
      }
      for (const s of scopes) {
        if (s.scope === "whatsapp_business_management" && s.target_ids?.[0]) wabaId = s.target_ids[0];
        if (s.scope === "whatsapp_business_messaging" && s.target_ids?.[0]) phoneNumberId = s.target_ids[0];
      }
      if (!wabaId) {
        const names = scopes.map((s: any) => s.scope).join(", ") || "none";
        diagnostics.push(`No whatsapp_business_management in granular_scopes. Granted scopes: ${names}.`);
      }
    }
  } catch (err: any) {
    diagnostics.push(`debug_token request failed: ${err?.message || "network error"}`);
  }

  // 2. Fallback — direct user→WABA edge (personal accounts that own the WABA outright).
  if (!wabaId) {
    try {
      const res = await fetch(`${WA_API_URL}/me/whatsapp_business_accounts?fields=id&access_token=${userToken}`);
      const json = await res.json();
      if (json?.error) diagnostics.push(`me/whatsapp_business_accounts error: ${json.error.message}`);
      else if (json?.data?.[0]?.id) wabaId = json.data[0].id;
      else diagnostics.push("me/whatsapp_business_accounts returned an empty list.");
    } catch {
      diagnostics.push("me/whatsapp_business_accounts request failed.");
    }
  }

  // 3. Fallback — Business Portfolio → WABA.
  if (!wabaId) {
    try {
      const res = await fetch(
        `${WA_API_URL}/me/businesses?fields=id,name,whatsapp_business_accounts{id}&access_token=${userToken}`
      );
      const json = await res.json();
      if (json?.error) {
        diagnostics.push(`me/businesses error: ${json.error.message}`);
      } else {
        const businesses = json?.data || [];
        if (businesses.length === 0) diagnostics.push("me/businesses returned no Business Portfolios.");
        for (const biz of businesses) {
          const id = biz?.whatsapp_business_accounts?.data?.[0]?.id;
          if (id) { wabaId = id; break; }
        }
        if (!wabaId && businesses.length > 0) {
          diagnostics.push(`Found ${businesses.length} Business Portfolio(s) but none has a WhatsApp Business Account.`);
        }
      }
    } catch {
      diagnostics.push("me/businesses request failed.");
    }
  }

  // 4. Resolve a phone number from the WABA if the token scopes didn't name one.
  if (wabaId && !phoneNumberId) {
    try {
      const res = await fetch(`${WA_API_URL}/${wabaId}/phone_numbers?fields=id&access_token=${userToken}`);
      const json = await res.json();
      if (json?.error) diagnostics.push(`${wabaId}/phone_numbers error: ${json.error.message}`);
      else if (json?.data?.[0]?.id) phoneNumberId = json.data[0].id;
      else diagnostics.push("WABA found but it has no phone numbers registered yet.");
    } catch {
      diagnostics.push(`${wabaId}/phone_numbers request failed.`);
    }
  }

  return { wabaId, phoneNumberId, diagnostics };
}

/** Fetches display_phone_number and verified_name for a phone number ID. */
export async function fetchPhoneDetails(phoneNumberId: string, token: string) {
  try {
    const res = await fetch(
      `${WA_API_URL}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${token}`
    );
    const json = await res.json();
    if (json?.error) return null;
    return {
      display_phone_number: json.display_phone_number as string | undefined,
      verified_name: json.verified_name as string | undefined,
    };
  } catch {
    return null;
  }
}
