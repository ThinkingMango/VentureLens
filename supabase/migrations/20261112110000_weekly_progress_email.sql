begin;

-- Weekly progress email (enhancement plan WP-17). Decision E2 (2026-11-12): on by default for founders with an active
-- validation sprint, an opt-out link in every email, and a switch on the profile page.

-- The founder's choice, changed on /profile through the existing own-row update policy, or by the signed opt-out link
-- (the service role, lib/weekly.ts).
alter table public.founder_profiles add column notify_weekly boolean not null default true;

-- One row per founder per week (its Monday, UTC) once that week's email is claimed. The daily cron run inserts the row
-- before sending, so a retried or overlapping run never sends a second email that week; a failed send deletes it again
-- so the next day's run can retry. Founders can neither read nor write it: RLS is enabled and forced with no policies,
-- and only the service role has grants. Rows go with the account.
create table public.weekly_emails (
  user_id uuid not null references auth.users(id) on delete cascade,
  week date not null check (extract(isodow from week) = 1),
  sent_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.weekly_emails enable row level security;
alter table public.weekly_emails force row level security;
revoke all on public.weekly_emails from public, anon, authenticated;
grant select, insert, delete on public.weekly_emails to service_role;

commit;
