import { isPlaceholderName } from "@/lib/auth/display-name";

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
      // Both whatsapp_* scopes list WABA IDs in target_ids — never phone number IDs.
      // The phone number ID is resolved separately from the WABA's phone_numbers edge.
      for (const s of scopes) {
        if (
          (s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging") &&
          s.target_ids?.[0]
        ) {
          wabaId = wabaId || s.target_ids[0];
        }
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

  // 4. Resolve the phone number ID from the WABA's phone_numbers edge.
  if (wabaId) {
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

/**
 * True when a stored row is missing a usable phone number ID. Rows written by
 * earlier builds either left it as "unknown" or copied the WABA ID into it, both
 * of which make the inbound webhook lookup miss and silently drop every message.
 */
export function needsPhoneRepair(row: { phone_number_id?: string | null; waba_id?: string | null }): boolean {
  const { phone_number_id: pid, waba_id: wid } = row;
  return !pid || pid === "unknown" || pid === wid;
}

/**
 * True when the stored business name or phone number is still a placeholder.
 * Meta populates verified_name only once the number clears business verification,
 * so a row saved before that needs re-reading rather than being left generic —
 * otherwise the UI keeps falling back to the Facebook account name.
 */
export function needsProfileRefresh(row: {
  display_name?: string | null;
  phone_number?: string | null;
}): boolean {
  return isPlaceholderName(row.display_name) || isPlaceholderName(row.phone_number);
}

/**
 * Re-resolves the phone number for a connection whose stored ID is missing or wrong
 * and writes the corrected values back. Returns the repaired row, or null if the
 * WABA still has no usable phone number.
 */
export async function repairPhoneNumber(
  supabase: any,
  row: { user_id: string; waba_id: string; access_token: string },
) {
  const res = await fetch(
    `${WA_API_URL}/${row.waba_id}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${row.access_token}`
  );
  const json = await res.json().catch(() => null);
  const phone = json?.data?.[0];
  if (!phone?.id) return null;

  // Only write values Meta actually returned, so an unverified number does not
  // overwrite a good stored name with a placeholder on every page load.
  const patch: Record<string, string> = {
    phone_number_id: phone.id,
    updated_at: new Date().toISOString(),
  };
  if (phone.display_phone_number) patch.phone_number = phone.display_phone_number;
  if (phone.verified_name) patch.display_name = phone.verified_name;

  await supabase.from("wa_connections").update(patch).eq("user_id", row.user_id);
  return { ...row, ...patch };
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
