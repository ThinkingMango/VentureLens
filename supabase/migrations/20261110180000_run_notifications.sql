begin;

-- "Report ready" email (spec WP-08). The workflow claims a finished run by setting notified_at from null in one
-- update, so each run sends at most one email however often its last step is retried. Only the service role writes it:
-- authenticated users still have no update grant on research_runs.
alter table public.research_runs add column notified_at timestamptz;

-- The founder's choice, on by default; changed on /profile through the existing own-row update policy.
alter table public.founder_profiles add column notify_on_complete boolean not null default true;

commit;
