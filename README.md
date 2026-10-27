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
