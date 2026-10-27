# ReplyKaro

WhatsApp Business and Meta Ads automation platform.

## Architecture

| Where | What runs there |
| --- | --- |
| **Vercel** | Rendering only: marketing pages, dashboard, short API routes, Meta webhooks |
| **Railway worker** (`worker/`) | Everything scheduled or long-running: scheduled broadcasts, token refresh, quality sync, data-retention purge |
| **Supabase** | Postgres. The whole schema is `supabase/schema.sql` |

The worker imports the same job modules (`lib/jobs/*`, `lib/whatsapp/broadcast-runner.ts`) as the app, so business rules such as consent checks live in one place. The `/api/cron/*` routes remain as manual triggers (protected by `CRON_SECRET`); nothing schedules them on Vercel.

## Deploying the worker on Railway

1. Create a Railway service from this repo. `railway.json` sets the start command (`npm run worker`) and the `/health` check.
2. Set these variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`.
3. Run `supabase/schema.sql` in the Supabase SQL editor first. It is idempotent: safe on a new project and on an existing one, and it creates the job lock tables the worker needs.

Jobs run on the Asia/Kolkata clock: scheduled broadcasts every minute, token refresh 02:00, quality sync every 6 hours, retention purge 03:30. A lock per job means extra replicas never run the same job twice. Run history is in `worker_job_runs`.

Local run: `npm run worker`.

## DPDP Act 2023

- Every consent grant or withdrawal is an append-only row in `wa_consent_logs` (source, purposes, notice version).
- Contacts added from the dashboard or CSV require the business to confirm consent. Promotional templates go only to contacts with marketing consent.
- Contacts can reply STOP to withdraw; the change takes effect immediately.
- `/data-request` accepts access, correction, erasure, grievance and consent-withdrawal requests into `dsr_requests` with a 30-day due date.
- Messages are purged after 90 days.

## Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## REST API and MCP

Everything the dashboard does is available over a REST API (`/api/v1/*`) and as an MCP server (`/api/mcp`), authenticated with an API key from **API & integrations**. API access needs a paid plan. Keys are shown once and stored only as a SHA-256 hash.

The dashboard, REST API and MCP server share one operations layer (`lib/api/ops.ts`, `lib/api/send.ts`), so rules such as consent, plan limits and template validation are written once. Add a feature there first, then expose it in the routes and in `lib/mcp/server.ts`.

Safety rules built into the tools: contacts need confirmed consent, free text is refused outside the 24-hour window, broadcasts are created as drafts and sent only with explicit confirmation, and customer message text is labelled as untrusted data.

## Scale, limits and safety

**Architecture.** The web app (Vercel) only renders pages and stores work; the Railway worker does the work.

| Work | How it scales |
| --- | --- |
| Incoming webhooks | The endpoint verifies the signature, writes the payload to `wa_webhook_events` and returns. Worker replicas claim batches (`FOR UPDATE SKIP LOCKED`), keep one number's events in order, retry failures, and park poison events after 5 attempts. |
| Broadcasts | Queued, then sent by the worker in batches of 200 pulled from the database, paced under Meta's throughput, with results written back in bulk. A lease with a heartbeat lets another worker resume after a crash. Audiences ("everyone", a label) are resolved in SQL, so size does not matter. |
| Dashboard numbers | Counted in the database (`message_daily_counts`, `audience_preview`, `unique_template_recipients_24h`), never by downloading rows. Lists are paged. |
| Retention | Expired messages are deleted in batches of 10,000. |

Run more worker replicas to go faster; they coordinate through the database. Tuning variables: `BROADCAST_RATE_PER_SECOND` (default 40), `BROADCAST_CONCURRENCY` (20), `BROADCAST_PARALLEL` (2 broadcasts per replica), `WEBHOOK_BATCH` (50), `WEBHOOK_CONCURRENCY` (8).

**Meta's real limits** (from Meta's WhatsApp Business Platform documentation):

- **Messaging limit:** distinct customers a business portfolio can message outside customer service windows in a rolling 24 hours. Tiers 250, 2,000, 10,000, 100,000, unlimited; new portfolios start at 250; the limit is shared by every number in the portfolio. `lib/whatsapp/limits.ts`.
- **Throughput:** 80 messages per second per number by default, automatic upgrade to 1,000 once the number sends to 100K+ users in 24 hours with at least yellow quality. Above it Meta returns error 130429.
- **Customer service window:** 24 hours from the customer's last message or call, reset each time. Outside it only approved templates.
- **Quality rating:** GREEN, YELLOW or RED. Red pauses promotions and automations here.
- **Enforcement** (`account_update` webhook): warning, then 1 or 3 day template block, then 5, 7 or 30 day block on business-started messages, then lock, then disablement. Restrictions block sending here until they expire.
- **Error codes** are handled per Meta's reference in `lib/whatsapp/errors.ts`.

**Honest limits of this design.** The messaging limit is portfolio-wide, but the app can only count what it sent, so if the same portfolio also messages through another tool the app under-counts. Meta's exact per-user promotion cap was not stated in the documentation we could read, so it is handled by reacting to error 131049 rather than predicting it. At very high sustained volume the next steps are partitioning `wa_messages` by month (so retention becomes dropping a partition) and a read replica for dashboards.
