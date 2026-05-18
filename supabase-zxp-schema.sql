-- ═══════════════════════════════════════════════════════════════
-- ZEXUS — ZXP Economic System (run after supabase-schema.sql)
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to re-run (idempotent)
-- ═══════════════════════════════════════════════════════════════


-- ── STEP 1: Extend profiles (add any missing columns) ─────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zxp_balance   INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zxp_staked    INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS claim_streak  INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_claim_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS settings      JSONB       NOT NULL DEFAULT '{}';


-- ── STEP 2: user_watchlist ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watchlist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, project_id)
);
CREATE INDEX IF NOT EXISTS wl_wallet_idx ON user_watchlist(wallet_address);
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "watchlist_public_read" ON user_watchlist;
CREATE POLICY "watchlist_public_read" ON user_watchlist FOR SELECT USING (true);


-- ── STEP 3: daily_checkins ────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_checkins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  checkin_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_day     INTEGER NOT NULL DEFAULT 1,
  zxp_earned     INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, checkin_date)
);
CREATE INDEX IF NOT EXISTS dc_wallet_idx ON daily_checkins(wallet_address);
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checkins_public_read" ON daily_checkins;
CREATE POLICY "checkins_public_read" ON daily_checkins FOR SELECT USING (true);


-- ── STEP 4: staking_positions (Layer 1 off-chain) ─────────────
CREATE TABLE IF NOT EXISTS staking_positions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address       TEXT NOT NULL,
  amount               INTEGER NOT NULL CHECK (amount > 0),
  staked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unstake_requested_at TIMESTAMPTZ,
  unstake_available_at TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'unstaking', 'completed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sp_wallet_idx ON staking_positions(wallet_address);
ALTER TABLE staking_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "positions_public_read" ON staking_positions;
CREATE POLICY "positions_public_read" ON staking_positions FOR SELECT USING (true);


-- ── STEP 5: zxp_transactions (audit log) ─────────────────────
CREATE TABLE IF NOT EXISTS zxp_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  type           TEXT NOT NULL
                 CHECK (type IN ('claim', 'stake', 'unstake', 'reward', 'burn')),
  amount         INTEGER NOT NULL,
  note           TEXT,
  balance_after  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ztx_wallet_idx ON zxp_transactions(wallet_address);
ALTER TABLE zxp_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ztx_public_read" ON zxp_transactions;
CREATE POLICY "ztx_public_read" ON zxp_transactions FOR SELECT USING (true);


-- ── STEP 6: verdict_history (placeholder for voting system) ──
CREATE TABLE IF NOT EXISTS verdict_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  post_id        UUID REFERENCES posts(id) ON DELETE SET NULL,
  post_title     TEXT,
  post_project   TEXT,
  verdict        TEXT CHECK (verdict IN ('yes', 'no')),
  was_correct    BOOLEAN,
  zxp_earned     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vh_wallet_idx ON verdict_history(wallet_address);
ALTER TABLE verdict_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vh_public_read" ON verdict_history;
CREATE POLICY "vh_public_read" ON verdict_history FOR SELECT USING (true);
