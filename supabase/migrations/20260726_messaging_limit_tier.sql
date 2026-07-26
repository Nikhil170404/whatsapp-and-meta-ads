-- ===========================================================================
-- Store Meta's messaging limit tier as the string Meta actually returns.
--
-- The existing integer `messaging_tier` column could not represent Meta's real
-- values (TIER_250, TIER_1K, TIER_10K, TIER_100K, TIER_UNLIMITED). Parsing them
-- as integers gave 10 for TIER_10K and NaN for TIER_UNLIMITED, both of which fell
-- back to the 1,000/day cap — so customers who had earned a higher limit were
-- being throttled, and TIER_250 accounts were allowed to oversend.
--
-- The numeric allowance is derived in code (lib/whatsapp/messaging-limits.ts)
-- rather than stored, because TIER_UNLIMITED has no integer representation.
-- `messaging_tier` is kept and still populated for older callers.
-- Idempotent — safe to run more than once.
-- ===========================================================================

ALTER TABLE wa_connections
  ADD COLUMN IF NOT EXISTS messaging_limit_tier TEXT DEFAULT 'TIER_250';

-- Backfill from the legacy integer column using its original intent
-- (1 = 1k/day, 2 = 10k, 3 = 100k, 4 = unlimited).
UPDATE wa_connections
SET messaging_limit_tier = CASE messaging_tier
    WHEN 1 THEN 'TIER_1K'
    WHEN 2 THEN 'TIER_10K'
    WHEN 3 THEN 'TIER_100K'
    WHEN 4 THEN 'TIER_UNLIMITED'
    ELSE 'TIER_250'
  END
WHERE messaging_limit_tier IS NULL OR messaging_limit_tier = 'TIER_250';

COMMENT ON COLUMN wa_connections.messaging_limit_tier IS
  'Raw messaging_limit_tier from Meta: TIER_250 | TIER_1K | TIER_10K | TIER_100K | TIER_UNLIMITED. Daily allowance derived in lib/whatsapp/messaging-limits.ts.';
