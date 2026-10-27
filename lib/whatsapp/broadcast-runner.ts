import { sendTemplateMessage, sleep } from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { resolveBodyParameters } from "@/lib/whatsapp/template-builder";
import { mapWithConcurrency, pacingDelayMs } from "@/lib/whatsapp/pacing";
import { parseMessagingLimit, parseQuality, remainingCapacity } from "@/lib/whatsapp/limits";
import { classifyMetaError } from "@/lib/whatsapp/errors";
import { isRestricted } from "@/lib/whatsapp/enforcement";
import { recordMarketingPreference } from "@/lib/consent";

/**
 * Broadcast engine, built for very large audiences.
 *
 *  - Sending is a background job: the web app only queues a broadcast; a worker
 *    (Railway) claims it and sends. Nothing waits on a web request.
 *  - Recipients are processed in batches pulled straight from the database, and
 *    every outcome is written back in bulk, so memory use and database calls do
 *    not grow with the audience.
 *  - Several messages are in flight at once, paced to stay inside Meta's limit.
 *  - A broadcast carries a lease. If the worker stops (deploy, crash), another
 *    worker resumes where it left off.
 *  - Problems that need the owner (expired token, payment issue, daily limit)
 *    pause the broadcast with a plain explanation instead of failing silently.
 */

// Meta allows 80 messages per second per number by default. Stay well inside it.
const RATE_PER_SECOND = Number(process.env.BROADCAST_RATE_PER_SECOND) || 40;
const CONCURRENCY = Number(process.env.BROADCAST_CONCURRENCY) || 20;
const CHUNK_SIZE = 200;
const MIN_RATE = 5;

export interface JobOutcome {
  status: "completed" | "paused" | "failed";
  sent: number;
  failed: number;
  message?: string;
}

export interface PreflightResult {
  ok: boolean;
  status?: number;
  error?: string;
  code?: string;
}

/** Checks that would stop a broadcast, so the user hears about them when they press Send. */
export async function preflightBroadcast(db: any, userId: string, templateId: string | null): Promise<PreflightResult> {
  const { data: conn } = await db.from("wa_connections")
    .select("status, quality_rating, quality_paused_at, restriction_blocks, restricted_until, restriction_summary")
    .eq("user_id", userId).maybeSingle();
  if (!conn || conn.status === "disconnected") return { ok: false, status: 400, error: "WhatsApp is not connected." };
  if (conn.status === "expired") return { ok: false, status: 400, error: "Your WhatsApp connection expired. Reconnect it first.", code: "TOKEN_EXPIRED" };
  if (isRestricted(conn)) {
    return { ok: false, status: 403, code: "ACCOUNT_RESTRICTED", error: conn.restriction_summary || "Meta has restricted this account, so messages cannot be sent right now." };
  }
  if (conn.quality_paused_at || parseQuality(conn.quality_rating).level === "poor") {
    return {
      ok: false, status: 403, code: "QUALITY_LOW",
      error: "Your number's quality rating is Poor (red), so promotions are paused to protect your account. Improve your content and audience, then wait for the rating to recover.",
    };
  }
  const { data: template } = templateId
    ? await db.from("wa_templates").select("name, status").eq("id", templateId).maybeSingle()
    : { data: null };
  if (!template) return { ok: false, status: 404, error: "Template not found." };
  if (template.status !== "approved") {
    return { ok: false, status: 400, code: "TEMPLATE_NOT_APPROVED", error: `Template "${template.name}" is ${template.status}, not approved by Meta. Only approved templates can be sent.` };
  }
  return { ok: true };
}

/** Puts a broadcast in line for the worker. Safe to call again on a paused or failed one to resume it. */
export async function queueBroadcast(db: any, userId: string, broadcastId: string) {
  const { data: b } = await db.from("wa_broadcasts").select("id, status, template_id").eq("id", broadcastId).eq("user_id", userId).maybeSingle();
  if (!b) return { ok: false as const, status: 404, error: "Broadcast not found." };
  if (b.status === "completed") return { ok: false as const, status: 400, error: "This broadcast was already sent." };
  if (b.status === "queued" || b.status === "sending") return { ok: true as const, queued: true, already: true };

  const pre = await preflightBroadcast(db, userId, b.template_id);
  if (!pre.ok) return { ok: false as const, status: pre.status ?? 400, error: pre.error!, code: pre.code };

  const { error } = await db.from("wa_broadcasts")
    .update({ status: "queued", error: null, scheduled_at: null })
    .eq("id", broadcastId).in("status", ["draft", "scheduled", "paused", "failed"]);
  if (error) return { ok: false as const, status: 500, error: error.message };
  return { ok: true as const, queued: true, already: false };
}

/** Moves broadcasts whose scheduled time has passed into the queue. */
export async function queueDueBroadcasts(db: any): Promise<number> {
  const { data, error } = await db.from("wa_broadcasts")
    .update({ status: "queued" })
    .eq("status", "scheduled").lte("scheduled_at", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

type SendResult = { id: string; status: "sent" | "failed" | "skipped" | "pending"; wamid?: string | null; error?: string | null };

/**
 * Claims one queued (or abandoned) broadcast and sends it to completion.
 * Returns null when there is nothing to claim.
 */
export async function runBroadcastJob(db: any, broadcastId: string): Promise<JobOutcome | null> {
  const { data: claimed } = await db.rpc("claim_broadcast", { p_id: broadcastId, p_stale_seconds: 120 });
  if (!claimed) return null;

  const stop = async (status: "paused" | "failed" | "completed", message: string | null, sent = 0, failed = 0): Promise<JobOutcome> => {
    await db.from("wa_broadcasts").update({ status, error: message, locked_at: null }).eq("id", broadcastId);
    return { status, sent, failed, message: message ?? undefined };
  };

  try {
    const { data: broadcast } = await db.from("wa_broadcasts").select("*").eq("id", broadcastId).single();
    const pre = await preflightBroadcast(db, broadcast.user_id, broadcast.template_id);
    if (!pre.ok) return stop(pre.code === "TEMPLATE_NOT_APPROVED" ? "failed" : "paused", pre.error!);

    const { data: conn } = await db.from("wa_connections")
      .select("phone_number_id, access_token, token_expires_at, messaging_limit_tier")
      .eq("user_id", broadcast.user_id).single();
    const { data: template } = await db.from("wa_templates").select("name, language, body_text, category").eq("id", broadcast.template_id).single();

    const token = await refreshWaTokenIfNeeded(db, {
      access_token: conn.access_token, token_expires_at: conn.token_expires_at, phone_number_id: conn.phone_number_id,
    });

    // Opted-out contacts and (for promotions) contacts without marketing consent are skipped in one statement.
    await db.rpc("skip_ineligible_recipients", { p_broadcast: broadcastId, p_marketing: template.category === "MARKETING" });

    // Meta's messaging limit: distinct customers messaged in a rolling 24 hours. Stop at the limit and
    // leave the rest waiting, so nobody is dropped and the account never pushes past what Meta allows.
    const limit = parseMessagingLimit(conn.messaging_limit_tier);
    const { data: used } = await db.rpc("unique_template_recipients_24h", { p_user: broadcast.user_id });
    let capacity = remainingCapacity({ limit, usedLast24h: used ?? 0 });
    if (capacity <= 0) {
      return stop("paused", `Meta's daily limit is reached: ${limit.label} customers per 24 hours on your account. Nothing was lost. Press Send again later and the rest will go out as the limit frees up.`);
    }
    const startingCapacity = capacity;

    let rate = RATE_PER_SECOND;
    let sentTotal = 0, failedTotal = 0;
    let abortReason: string | null = null;
    let limitReached = false;

    while (!abortReason) {
      if (capacity <= 0) { limitReached = true; break; }
      const take = Math.min(CHUNK_SIZE, Number.isFinite(capacity) ? capacity : CHUNK_SIZE);
      const { data: chunk, error } = await db.rpc("next_broadcast_chunk", { p_broadcast: broadcastId, p_limit: take });
      if (error) throw error;
      if (!chunk?.length) break;

      const startedAt = Date.now();
      let throttled = false;

      const results: SendResult[] = await mapWithConcurrency<any, SendResult>(chunk, CONCURRENCY, async (r) => {
        if (abortReason) return { id: r.recipient_id, status: "pending" }; // not attempted: back in line
        try {
          const params = resolveBodyParameters(template.body_text || "", broadcast.variables, {
            name: r.display_name && r.display_name !== r.phone_number ? r.display_name : null,
            phone: r.phone_number,
          });
          const res = await sendTemplateMessage(
            conn.phone_number_id, r.phone_number, template.name, template.language || "en_US", token,
            params.length ? [{ type: "body", parameters: params.map((v) => ({ type: "text", text: v })) }] : undefined
          );
          return { id: r.recipient_id, status: "sent", wamid: res.messages?.[0]?.id ?? null };
        } catch (err: any) {
          const m = err?.metaError;
          const verdict = classifyMetaError(m?.code, m ? `(#${m.code}) ${m.message}` : String(err?.message ?? "Unknown error"));
          if (verdict.action === "abort") {
            abortReason = verdict.reason;
            if (verdict.tokenExpired) {
              await db.from("wa_connections").update({ status: "expired", last_error: verdict.reason, last_error_at: new Date().toISOString() }).eq("user_id", broadcast.user_id);
            }
            if (verdict.templateProblem && (m?.code === 132015 || m?.code === 132016)) {
              await db.from("wa_templates").update({ status: "low_quality" }).eq("id", broadcast.template_id);
            }
            return { id: r.recipient_id, status: "pending" }; // not sent: stays in line for the resume
          }
          if (verdict.action === "throttle") { // Meta says slow down: retry this one later at a lower rate
            throttled = true;
            return { id: r.recipient_id, status: "pending" };
          }
          if (verdict.action === "skip") {
            if (verdict.marketingOptOut) {
              // They stopped promotions inside WhatsApp: remember it so no later broadcast tries again.
              await recordMarketingPreference(db, { userId: broadcast.user_id, phoneNumber: r.phone_number, value: "stop", evidence: { meta_error: 131050 } }).catch(() => {});
            }
            return { id: r.recipient_id, status: "skipped", error: verdict.reason };
          }
          return { id: r.recipient_id, status: "failed", error: verdict.reason };
        }
      });

      await db.rpc("record_recipient_results", { p_broadcast: broadcastId, p_results: results });
      for (const r of results) { if (r.status === "sent") sentTotal++; else if (r.status === "failed") failedTotal++; }
      // Every attempt may count toward Meta's limit, so spend capacity on attempts, not just successes.
      if (Number.isFinite(capacity)) capacity -= results.filter((r) => r.status !== "pending" && r.status !== "skipped").length;

      if (throttled) {
        rate = Math.max(MIN_RATE, Math.floor(rate / 2));
        await sleep(5000);
      } else {
        await sleep(pacingDelayMs(chunk.length, startedAt, rate));
      }
    }

    if (abortReason) return stop("paused", abortReason, sentTotal, failedTotal);

    if (limitReached) {
      const progress = (await db.rpc("broadcast_progress", { p_broadcast: broadcastId })).data ?? {};
      if ((progress.pending ?? 0) > 0) {
        return stop("paused", `Sent ${sentTotal.toLocaleString()} of today's ${startingCapacity.toLocaleString()} allowed by Meta (${limit.label} customers per 24 hours). ${(progress.pending as number).toLocaleString()} are waiting. Press Send again later and they will go out as the limit frees up.`, sentTotal, failedTotal);
      }
    }
    return stop("completed", null, sentTotal, failedTotal);
  } catch (err: any) {
    // Unexpected failure: leave the lease to expire so another worker retries.
    console.error(`[broadcast ${broadcastId}] job error:`, err);
    return { status: "failed", sent: 0, failed: 0, message: err?.message };
  }
}

/** Finds the next broadcast waiting for a worker (queued, or abandoned mid-send). */
export async function nextBroadcastToRun(db: any): Promise<string | null> {
  const stale = new Date(Date.now() - 120_000).toISOString();
  const { data } = await db.from("wa_broadcasts").select("id")
    .or(`status.eq.queued,and(status.eq.sending,locked_at.lt.${stale})`)
    .order("created_at", { ascending: true }).limit(1);
  return data?.[0]?.id ?? null;
}
