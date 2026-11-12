begin;

-- Share a report (enhancement plan WP-26, spec backlog #34). A founder can make a read-only link to one of their
-- completed reports and turn it off again. Links are unlisted (never indexed or listed anywhere); anyone with the link
-- can read the report without signing in, through the server (lib/shares.ts), which shows no profile or brief.
create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  -- 32 random bytes, base64url: unguessable, and the only thing the link carries.
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (id, user_id),
  -- Deleting the run (WP-12) or the account (WP-25) deletes its links.
  foreign key (run_id, user_id) references public.research_runs(id, user_id) on delete cascade
);
-- At most one live link per report; turning it off and on again makes a new link, so an old one never comes back.
create unique index report_shares_one_live on public.report_shares (run_id) where revoked_at is null;

alter table public.report_shares enable row level security;
alter table public.report_shares force row level security;
revoke all on public.report_shares from public, anon, authenticated;
-- Founders see, create and turn off their own links; a link's token and report never change once made.
grant select, insert on public.report_shares to authenticated;
grant update (revoked_at) on public.report_shares to authenticated;
grant all on public.report_shares to service_role;
create policy report_shares_select_own on public.report_shares for select to authenticated
  using ((select auth.uid()) = user_id);
-- Only for a completed run of their own: a link to a run still working or failed has nothing to show.
create policy report_shares_insert_own on public.report_shares for insert to authenticated
  with check ((select auth.uid()) = user_id and revoked_at is null and exists (
    select 1 from public.research_runs r where r.id = run_id and r.user_id = (select auth.uid()) and r.status = 'completed'
  ));
create policy report_shares_update_own on public.report_shares for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and revoked_at is not null);

commit;
