-- API keys for website integration (REST API access)
CREATE TABLE IF NOT EXISTS public.wa_api_keys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key         TEXT        NOT NULL UNIQUE DEFAULT ('rk_live_' || replace(gen_random_uuid()::text, '-', '')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wa_api_keys_key_idx ON public.wa_api_keys(api_key);

ALTER TABLE public.wa_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API key"
  ON public.wa_api_keys FOR ALL
  USING (auth.uid() = user_id);
