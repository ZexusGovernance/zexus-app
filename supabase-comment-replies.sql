-- ────────────────────────────────────────────────────────────────
-- Threaded replies for post_comments
-- Adds a nullable self-reference. Replies are single-level: a reply's
-- parent_id always points to a TOP-LEVEL comment (the API flattens
-- replies-to-replies onto their root), so the UI never nests deeper
-- than one level.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON post_comments(parent_id);
