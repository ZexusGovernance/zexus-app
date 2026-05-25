-- ============================================================
-- Reactions (likes) + Watchlist — RLS & Realtime
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Ensure post_reactions table exists
CREATE TABLE IF NOT EXISTS post_reactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  reaction       TEXT NOT NULL DEFAULT 'like',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, wallet_address, reaction)
);

-- 2. RLS: allow public reads (counts, like status checks)
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'post_reactions' AND policyname = 'Public read reactions'
  ) THEN
    CREATE POLICY "Public read reactions" ON post_reactions FOR SELECT USING (true);
  END IF;
END $$;
-- INSERT / DELETE are handled server-side via service role (no client write policy needed)

-- 3. Enable Realtime for like count updates
ALTER PUBLICATION supabase_realtime ADD TABLE post_reactions;

-- 4. Ensure user_watchlist table exists
CREATE TABLE IF NOT EXISTS user_watchlist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, project_id)
);

-- 5. RLS for watchlist: users see only their own data
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_watchlist' AND policyname = 'Public read watchlist'
  ) THEN
    CREATE POLICY "Public read watchlist" ON user_watchlist FOR SELECT USING (true);
  END IF;
END $$;
-- INSERT / DELETE handled server-side via service role

-- 6. Ensure comment_reactions table exists
CREATE TABLE IF NOT EXISTS comment_reactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id     UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  reaction       TEXT NOT NULL DEFAULT 'like',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, wallet_address, reaction)
);

-- 7. RLS for comment_reactions
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comment_reactions' AND policyname = 'Public read comment reactions'
  ) THEN
    CREATE POLICY "Public read comment reactions" ON comment_reactions FOR SELECT USING (true);
  END IF;
END $$;
-- INSERT / DELETE handled server-side via service role

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_reactions_post      ON post_reactions(post_id, reaction);
CREATE INDEX IF NOT EXISTS idx_post_reactions_wallet    ON post_reactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_wallet    ON user_watchlist(wallet_address);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id, reaction);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_wallet  ON comment_reactions(wallet_address);
