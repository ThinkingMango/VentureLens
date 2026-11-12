begin;

-- Report links expire 90 days after they are made (owner decision, 2026-11-12). An expired link shows the same
-- "no longer available" notice as one that was turned off; sharing the report again makes a new link.

-- Links made before this migration get 90 days from when they were made.
alter table public.report_shares add column expires_at timestamptz;
update public.report_shares set expires_at = created_at + interval '90 days' where expires_at is null;
alter table public.report_shares
  alter column expires_at set default (now() + interval '90 days'),
  alter column expires_at set not null,
  add constraint report_shares_expiry check (expires_at > created_at);

-- Founders may set only which report a link is for and its token. Its creation time and expiry always come from the
-- database, so nobody can make a link that lasts longer than 90 days.
revoke insert on public.report_shares from authenticated;
grant insert (user_id, run_id, token) on public.report_shares to authenticated;

commit;
