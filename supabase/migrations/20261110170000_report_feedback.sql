begin;

-- Report feedback (spec WP-13): a founder flags a claim or a source on one of their opportunities, and rates each of
-- their reports once (1–5). Users insert and read only their own rows; there is no update or delete in v1, except that
-- a rating is changed through rate_report(), which keeps one rating per report per user.
create table public.report_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  opportunity_id uuid,
  target text not null check (target in ('claim', 'source', 'report')),
  -- A claim's key is its position in the opportunity's claims ("claim-0"); a source's key is its source_key.
  target_key text not null default '' check (char_length(target_key) <= 100),
  reason text check (reason in ('wrong', 'outdated', 'irrelevant', 'broken_link', 'other')),
  comment text not null default '' check (char_length(comment) <= 1000),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, user_id) references public.research_runs(id, user_id) on delete cascade,
  foreign key (opportunity_id, user_id) references public.opportunities(id, user_id) on delete cascade,
  -- A flag names an opportunity, a key and a reason, and has no rating; a rating is about the whole report.
  check (
    (target = 'report' and opportunity_id is null and target_key = '' and reason is null and rating is not null)
    or (target in ('claim', 'source') and opportunity_id is not null and target_key ~ '^[A-Za-z0-9_.:-]{1,100}$'
        and reason is not null and rating is null)
  )
);
-- One rating per report per user, and one flag per claim or source per user.
create unique index report_feedback_one_rating on public.report_feedback (user_id, run_id) where target = 'report';
create unique index report_feedback_one_flag on public.report_feedback (user_id, opportunity_id, target, target_key) where target <> 'report';
create index report_feedback_created_idx on public.report_feedback (created_at desc);
create index report_feedback_run_idx on public.report_feedback (run_id, user_id);
create index report_feedback_opportunity_idx on public.report_feedback (opportunity_id, user_id) where opportunity_id is not null;

alter table public.report_feedback enable row level security;
alter table public.report_feedback force row level security;
revoke all on public.report_feedback from public, anon, authenticated, service_role;
grant select, insert on public.report_feedback to authenticated;
-- The operator quality page reads aggregates with the service role.
grant select on public.report_feedback to service_role;

create policy report_feedback_select_own on public.report_feedback for select to authenticated
  using ((select auth.uid()) = user_id);
-- Flags only: a rating goes through rate_report(). The flagged opportunity must be the user's and belong to the run.
create policy report_feedback_insert_own_flag on public.report_feedback for insert to authenticated with check (
  (select auth.uid()) = user_id
  and target in ('claim', 'source')
  and exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and o.user_id = (select auth.uid()) and o.run_id = report_feedback.run_id
  )
);

-- Rates one of the caller's finished reports, or changes their earlier rating of it.
create function public.rate_report(p_run_id uuid, p_rating integer, p_comment text default '')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING' using errcode = '22023';
  end if;
  if char_length(v_comment) > 1000 then
    raise exception 'COMMENT_TOO_LONG' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.research_runs r
    where r.id = p_run_id and r.user_id = v_user and r.status in ('completed', 'failed')
  ) then
    raise exception 'REPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.report_feedback (user_id, run_id, target, target_key, rating, comment)
  values (v_user, p_run_id, 'report', '', p_rating, v_comment)
  on conflict (user_id, run_id) where target = 'report'
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end;
$$;
revoke all on function public.rate_report(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.rate_report(uuid, integer, text) to authenticated;

commit;
