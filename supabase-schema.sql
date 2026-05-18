-- ═══════════════════════════════════════════════════════════════
-- ZEXUS — Complete Supabase Schema (idempotent — safe to re-run)
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════


-- ── STEP 1: Clean up old post-related objects ──────────────────
-- projects & profiles are preserved (they may already have data).
-- posts and everything that depends on it is dropped and recreated
-- because the old schema may be missing required columns.

DROP VIEW  IF EXISTS posts_feed                       CASCADE;
DROP TABLE IF EXISTS trust_score_log                  CASCADE;
DROP TABLE IF EXISTS post_reactions                   CASCADE;
DROP TABLE IF EXISTS post_comments                    CASCADE;
DROP TABLE IF EXISTS posts                            CASCADE;


-- ── STEP 2: ENUM types ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE post_type AS ENUM ('update', 'verdict', 'alert');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reaction_type AS ENUM ('like', 'dislike');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── STEP 3: projects ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  admin_wallet  TEXT NOT NULL UNIQUE,
  avatar_url    TEXT,
  website_url   TEXT,
  trust_score   INTEGER NOT NULL DEFAULT 50
                CHECK (trust_score BETWEEN 0 AND 100),
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  has_token     BOOLEAN NOT NULL DEFAULT false,
  show_holders  BOOLEAN NOT NULL DEFAULT true,
  show_votes    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns to existing databases (idempotent)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_token    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS show_holders BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS show_votes   BOOLEAN NOT NULL DEFAULT true;

INSERT INTO projects (slug, name, description, category, admin_wallet, is_verified, trust_score)
VALUES (
  'aerobase',
  'AeroBase',
  'AMM protocol on Base Mainnet',
  'AMM',
  '0x03c99dc0ac4bd5ada983de615416443b24bf98d6',
  true,
  85
)
ON CONFLICT (slug) DO NOTHING;


-- ── STEP 4: profiles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── STEP 5: posts ──────────────────────────────────────────────
CREATE TABLE posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_wallet       TEXT NOT NULL,
  post_type           post_type NOT NULL DEFAULT 'update',
  title               TEXT,
  content             TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  image_url           TEXT,
  trust_score_change  INTEGER NOT NULL DEFAULT 0
                      CHECK (trust_score_change BETWEEN -20 AND 20),
  is_pinned           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX posts_project_id_idx ON posts(project_id);


-- ── STEP 6: post_comments ──────────────────────────────────────
CREATE TABLE post_comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_wallet  TEXT NOT NULL,
  content        TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX comments_post_id_idx ON post_comments(post_id);


-- ── STEP 7: post_reactions ─────────────────────────────────────
CREATE TABLE post_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  wallet_address  TEXT NOT NULL,
  reaction        reaction_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, wallet_address)
);

CREATE INDEX reactions_post_id_idx ON post_reactions(post_id);


-- ── STEP 8: trust_score_log ────────────────────────────────────
CREATE TABLE trust_score_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE SET NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT,
  score_after INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tsl_project_id_idx ON trust_score_log(project_id);


-- ── STEP 9: trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _apply_trust_score_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_score INTEGER;
BEGIN
  IF NEW.trust_score_change = 0 THEN
    RETURN NEW;
  END IF;

  UPDATE projects
  SET trust_score = GREATEST(0, LEAST(100, trust_score + NEW.trust_score_change)),
      updated_at  = NOW()
  WHERE id = NEW.project_id
  RETURNING trust_score INTO new_score;

  INSERT INTO trust_score_log (project_id, post_id, delta, reason, score_after)
  VALUES (
    NEW.project_id, NEW.id, NEW.trust_score_change,
    COALESCE(NEW.title, NEW.post_type::text),
    new_score
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_insert_apply_trust_score ON posts;
CREATE TRIGGER on_post_insert_apply_trust_score
AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION _apply_trust_score_change();


-- ── STEP 10: posts_feed view ───────────────────────────────────
CREATE VIEW posts_feed AS
SELECT
  p.id,
  p.project_id,
  p.author_wallet,
  p.post_type,
  p.title,
  p.content,
  p.image_url,
  p.trust_score_change,
  p.is_pinned,
  p.created_at,
  p.updated_at,
  proj.name         AS project_name,
  proj.slug         AS project_slug,
  proj.category     AS project_category,
  proj.avatar_url   AS project_avatar_url,
  proj.trust_score  AS project_trust_score,
  COALESCE(lk.cnt,  0) AS likes_count,
  COALESCE(dl.cnt,  0) AS dislikes_count,
  COALESCE(cm.cnt,  0) AS comments_count
FROM posts p
JOIN projects proj ON proj.id = p.project_id
LEFT JOIN (
  SELECT post_id, COUNT(*) AS cnt
  FROM post_reactions WHERE reaction = 'like' GROUP BY post_id
) lk ON lk.post_id = p.id
LEFT JOIN (
  SELECT post_id, COUNT(*) AS cnt
  FROM post_reactions WHERE reaction = 'dislike' GROUP BY post_id
) dl ON dl.post_id = p.id
LEFT JOIN (
  SELECT post_id, COUNT(*) AS cnt
  FROM post_comments GROUP BY post_id
) cm ON cm.post_id = p.id;

GRANT SELECT ON posts_feed TO anon, authenticated;


-- ── STEP 11: RLS ───────────────────────────────────────────────
ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_score_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_public_read"        ON projects;
DROP POLICY IF EXISTS "profiles_public_read"        ON profiles;
DROP POLICY IF EXISTS "posts_public_read"           ON posts;
DROP POLICY IF EXISTS "post_comments_public_read"   ON post_comments;
DROP POLICY IF EXISTS "post_reactions_public_read"  ON post_reactions;
DROP POLICY IF EXISTS "trust_score_log_public_read" ON trust_score_log;

CREATE POLICY "projects_public_read"        ON projects         FOR SELECT USING (true);
CREATE POLICY "profiles_public_read"        ON profiles         FOR SELECT USING (true);
CREATE POLICY "posts_public_read"           ON posts            FOR SELECT USING (true);
CREATE POLICY "post_comments_public_read"   ON post_comments    FOR SELECT USING (true);
CREATE POLICY "post_reactions_public_read"  ON post_reactions   FOR SELECT USING (true);
CREATE POLICY "trust_score_log_public_read" ON trust_score_log  FOR SELECT USING (true);
