begin;

-- Validation sprint workspace v1 (spec WP-10): a founder turns an opportunity into a 7, 14 or 30-day sprint of tasks,
-- with go/no-go criteria and a final keep / park / kill decision. Each founder sees and changes only their own rows.
create table public.validation_sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null,
  length_days integer not null check (length_days in (7, 14, 30)),
  started_on date not null default current_date,
  go_criteria text not null default '' check (char_length(go_criteria) <= 1000),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  decision text check (decision in ('keep', 'park', 'kill')),
  decision_note text not null default '' check (char_length(decision_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (opportunity_id, user_id) references public.opportunities(id, user_id) on delete cascade,
  -- A decision completes the sprint, and a completed sprint has one.
  check ((status = 'completed') = (decision is not null))
);
-- At most one active sprint per opportunity per founder.
create unique index validation_sprints_one_active on public.validation_sprints (user_id, opportunity_id) where status = 'active';
create index validation_sprints_owner_idx on public.validation_sprints (user_id, status, created_at desc);
create index validation_sprints_opportunity_idx on public.validation_sprints (opportunity_id, user_id);

create table public.validation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sprint_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  detail text not null default '' check (char_length(detail) <= 1000),
  due_on date,
  done_at timestamptz,
  position integer not null check (position between 0 and 1000),
  origin text not null check (origin in ('report', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sprint_id, user_id) references public.validation_sprints(id, user_id) on delete cascade
);
create index validation_tasks_sprint_idx on public.validation_tasks (sprint_id, position);
create index validation_tasks_owner_due_idx on public.validation_tasks (user_id, due_on) where done_at is null;

-- A sprint holds at most 50 tasks, so a page never has to deal with an unbounded list.
create function public.limit_validation_tasks() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.validation_tasks t where t.sprint_id = new.sprint_id) >= 50 then
    raise exception 'TOO_MANY_TASKS' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_validation_tasks() from public, anon, authenticated;
create trigger limit_validation_tasks before insert on public.validation_tasks
  for each row execute function public.limit_validation_tasks();

do $$
declare table_name text;
begin
  foreach table_name in array array['validation_sprints', 'validation_tasks'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create trigger workspace_updated_at before update on public.%I for each row execute function public.set_workspace_updated_at()', table_name);
  end loop;
end;
$$;

-- Sprints: created (through start_validation_sprint, which runs as the founder) and updated, never deleted; abandoning
-- one keeps its history. Only the founder's own fields can change, not which opportunity or how long.
grant select, insert on public.validation_sprints to authenticated;
grant update (go_criteria, status, decision, decision_note) on public.validation_sprints to authenticated;
create policy validation_sprints_insert_own on public.validation_sprints for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.user_id = (select auth.uid()))
);
create policy validation_sprints_update_own on public.validation_sprints for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Tasks: the founder adds, edits, reorders, ticks and removes their own, in their own sprints.
grant select, insert, delete on public.validation_tasks to authenticated;
grant update (title, detail, due_on, done_at, position) on public.validation_tasks to authenticated;
create policy validation_tasks_insert_own on public.validation_tasks for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.validation_sprints s where s.id = sprint_id and s.user_id = (select auth.uid()))
);
create policy validation_tasks_update_own on public.validation_tasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy validation_tasks_delete_own on public.validation_tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

/**
 * Starts a sprint on one of the caller's opportunities and seeds its tasks: first the fixed first steps the founder
 * already saw on the opportunity page (p_checklist, in their language), ticked where saved_opportunities.completed_tasks
 * says they were ticked, then the research's own validation[] steps. Due dates are spread evenly across the sprint,
 * the last task falling on its last day. The opportunity is saved if it was not. completed_tasks is read, never changed.
 * Runs as the caller, so row-level security applies throughout.
 */
create function public.start_validation_sprint(p_opportunity uuid, p_length integer, p_checklist text[] default '{}')
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_payload jsonb;
  v_done text[];
  v_sprint uuid;
  v_started date := current_date;
  v_titles text[] := '{}';
  v_ticked boolean[] := '{}';
  v_item text;
  v_index integer := 0;
  v_count integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_length is null or p_length not in (7, 14, 30) then
    raise exception 'INVALID_LENGTH' using errcode = '22023';
  end if;
  select o.payload into v_payload from public.opportunities o where o.id = p_opportunity and o.user_id = v_user;
  if v_payload is null then
    raise exception 'OPPORTUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.validation_sprints s where s.user_id = v_user and s.opportunity_id = p_opportunity and s.status = 'active') then
    raise exception 'SPRINT_ACTIVE' using errcode = '23505';
  end if;

  insert into public.saved_opportunities (user_id, opportunity_id) values (v_user, p_opportunity)
  on conflict (user_id, opportunity_id) do nothing;
  select coalesce(s.completed_tasks, '{}') into v_done from public.saved_opportunities s
  where s.user_id = v_user and s.opportunity_id = p_opportunity;

  -- The fixed first steps (at most four, as on the page), each ticked if its index was ticked before.
  foreach v_item in array coalesce(p_checklist[1:4], '{}') loop
    if char_length(btrim(coalesce(v_item, ''))) > 0 then
      v_titles := v_titles || left(btrim(v_item), 300);
      v_ticked := v_ticked || ((p_opportunity::text || '-' || v_index::text) = any (v_done));
    end if;
    v_index := v_index + 1;
  end loop;
  -- The research's validation steps, at most twelve.
  for v_item in
    select btrim(step) from jsonb_array_elements_text(case when jsonb_typeof(v_payload -> 'validation') = 'array' then v_payload -> 'validation' else '[]'::jsonb end) with ordinality as e(step, n)
    where char_length(btrim(step)) > 0 order by n limit 12
  loop
    v_titles := v_titles || left(v_item, 300);
    v_ticked := v_ticked || false;
  end loop;

  insert into public.validation_sprints (user_id, opportunity_id, length_days, started_on)
  values (v_user, p_opportunity, p_length, v_started) returning id into v_sprint;

  v_count := coalesce(array_length(v_titles, 1), 0);
  for v_index in 1 .. v_count loop
    insert into public.validation_tasks (user_id, sprint_id, title, due_on, done_at, position, origin)
    values (v_user, v_sprint, v_titles[v_index],
      v_started + greatest(1, round(p_length::numeric * v_index / v_count))::integer,
      case when v_ticked[v_index] then now() end, v_index - 1, 'report');
  end loop;
  return v_sprint;
end;
$$;
revoke all on function public.start_validation_sprint(uuid, integer, text[]) from public, anon, authenticated;
grant execute on function public.start_validation_sprint(uuid, integer, text[]) to authenticated;

commit;
