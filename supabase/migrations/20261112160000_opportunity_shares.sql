begin;

-- Share one opportunity (owner request, 2026-11-12; follows WP-26). A link can now be for a whole report, as before, or
-- for one opportunity in it. Both kinds live in report_shares, so they share the same rules: unguessable tokens,
-- owner-only access, 90-day expiry, turned off for good, deleted with the report. Links made before this migration are
-- whole-report links (opportunity_id null) and keep working unchanged.
alter table public.report_shares add column opportunity_id uuid;

-- The opportunity must be one of the founder's own, from the same report the link names, so a link can never pair a
-- report with someone else's opportunity. Deleting the opportunity (or its report, or the account) deletes its links.
alter table public.opportunities add constraint opportunities_id_run_user_key unique (id, run_id, user_id);
alter table public.report_shares add constraint report_shares_opportunity_fkey
  foreign key (opportunity_id, run_id, user_id) references public.opportunities(id, run_id, user_id) on delete cascade;

-- At most one live link per report, and separately at most one live link per opportunity: sharing one opportunity does
-- not stop the founder sharing the whole report, or another opportunity.
drop index public.report_shares_one_live;
create unique index report_shares_one_live on public.report_shares (run_id) where revoked_at is null and opportunity_id is null;
create unique index report_shares_one_live_opportunity on public.report_shares (opportunity_id) where revoked_at is null and opportunity_id is not null;

-- Founders may also say which opportunity a link is for. The insert policy is unchanged: the report must be their own
-- and completed.
grant insert (opportunity_id) on public.report_shares to authenticated;

commit;
