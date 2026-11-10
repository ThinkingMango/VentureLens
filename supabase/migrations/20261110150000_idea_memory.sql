begin;

-- WP-04 idea memory: research avoids ideas a founder has already seen in their recent runs. "Clear idea memory" sets
-- this marker, and the memory read at the start of each run ignores opportunities and runs created at or before it.
-- Null (the default) means the memory has never been cleared.
alter table public.founder_profiles add column if not exists history_reset_at timestamptz;

-- Row-level security, policies and the table-level grants on founder_profiles are unchanged and cover the new column:
-- founders read and update only their own row.

commit;
