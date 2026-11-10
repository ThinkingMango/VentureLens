begin;

-- Non-commercial product events (spec WP-01 §4): what founders do in the product, recorded by the server only.
-- Users can neither read nor write this table. Writes come from the service role (lib/events.ts), which bypasses RLS;
-- RLS is still enabled and forced, with no policies, so a grant added by mistake later exposes nothing.
-- Events carry no personal data: the user id is kept for per-account funnels, and is cleared when the account is deleted.
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event ~ '^[a-z][a-z0-9_]{0,63}$'),
  props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 8192),
  created_at timestamptz not null default now()
);
create index product_events_created_idx on public.product_events (created_at desc);
create index product_events_event_created_idx on public.product_events (event, created_at desc);
create index product_events_user_idx on public.product_events (user_id) where user_id is not null;

alter table public.product_events enable row level security;
alter table public.product_events force row level security;
revoke all on public.product_events from public, anon, authenticated;
-- Events are append-only: the service role records and reads them, and never edits them.
grant select, insert on public.product_events to service_role;

-- Run lifecycle events are recorded by the database, so each is written exactly once on every path that starts or
-- ends a run: enqueue_research, finish_research, the workflow's failure step, a failed dispatch and the stale-run
-- recovery in researchDetail. A retried run that ends again records a second run_finished, one per attempt.
-- Props hold only codes, counts and fixed choices, matching lib/events-core.ts. Recording an event must never block
-- the run itself, so any failure here is swallowed.
create function public.record_run_lifecycle_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := new.configuration -> 'brief' ->> 'discovery_mode';
  v_language text := new.configuration -> 'brief' ->> 'language';
  v_props jsonb;
begin
  if v_mode is null or v_mode not in ('founder', 'market', 'combined') then v_mode := null; end if;
  if v_language is null or v_language not in ('en', 'zh-Hans', 'zh-Hant') then v_language := null; end if;
  begin
    if tg_op = 'INSERT' then
      insert into public.product_events (user_id, event, props)
      values (new.user_id, 'run_started', jsonb_strip_nulls(jsonb_build_object('mode', v_mode, 'language', v_language)));
    elsif new.status in ('completed', 'failed') and old.status is distinct from new.status then
      v_props := jsonb_build_object(
        'status', new.status,
        'error_code', case when new.error_code ~ '^[A-Z][A-Z0-9_]{0,39}$' then new.error_code end,
        'opportunities', (select count(*) from public.opportunities o where o.run_id = new.id and o.user_id = new.user_id));
      if v_mode is not null then v_props := v_props || jsonb_build_object('mode', v_mode); end if;
      insert into public.product_events (user_id, event, props) values (new.user_id, 'run_finished', v_props);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke all on function public.record_run_lifecycle_event() from public, anon, authenticated;
create trigger record_run_lifecycle_event
  after insert or update of status on public.research_runs
  for each row execute function public.record_run_lifecycle_event();

commit;
