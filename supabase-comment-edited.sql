-- Adds an edit timestamp to comments so the UI can show an "edited" marker.
-- Safe to run multiple times. Until this runs, the app degrades gracefully:
-- editing still works, the marker just isn't persisted across reloads.
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
