-- Short, shareable post IDs (nanoid-style, URL-safe) ────────────────────────
-- Adds posts.short_id with a Postgres generator so EVERY post — existing and
-- future — gets a unique short id automatically. The posts_feed view is left
-- untouched; the app reads short_id directly from the posts table.

-- 1. nanoid-style generator: URL-safe alphabet, default 10 chars (~1.1e18 space)
create or replace function gen_short_id(size int default 10)
returns text
language sql
volatile
as $$
  select string_agg(
    substr(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
      1 + floor(random() * 64)::int, 1
    ), ''
  )
  from generate_series(1, size);
$$;

-- 2. column
alter table posts add column if not exists short_id text;

-- 3. backfill existing rows
update posts set short_id = gen_short_id() where short_id is null;

-- 4. auto-generate for new rows + enforce presence & uniqueness
alter table posts alter column short_id set default gen_short_id();
alter table posts alter column short_id set not null;
create unique index if not exists posts_short_id_key on posts (short_id);
