begin;

-- Checklist progress independent of saving (ported from the closed #20, onto the WP-16 sprint function).
-- A saved_opportunities row holds two separate things: whether the founder saved the opportunity (saved) and their
-- checklist progress (completed_tasks). Before this, the row's existence meant "saved", so ticking a checklist step
-- quietly saved the opportunity, and unsaving deleted the row and with it the progress.
--
-- Existing rows were all shown as saved, so they keep saved = true. The default also stays true, so code deployed
-- before this migration (which only inserts a row to save) keeps its meaning during the rollout. The API sets
-- saved = false when a checklist tick creates the row, and unsaving clears the flag instead of deleting the row.
alter table public.saved_opportunities add column if not exists saved boolean not null default true;
-- The Saved list reads only saved rows.
create index if not exists saved_opportunities_owner_saved_idx on public.saved_opportunities (user_id, created_at desc) where saved;

-- Unchanged from 20261112100000_sprint_next_steps.sql except that starting a sprint marks the opportunity saved.
-- create or replace keeps the function's grants.
create or replace function public.start_validation_sprint(p_opportunity uuid, p_length integer, p_checklist text[] default '{}', p_labels text[] default '{}')
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_payload jsonb;
  v_done text[];
  v_sprint uuid;
  v_started date := current_date;
  v_titles text[] := '{}';
  v_details text[] := '{}';
  v_due date[] := '{}';
  v_ticked boolean[] := '{}';
  v_criteria text[] := '{}';
  v_item text;
  v_step jsonb;
  v_where text;
  v_detail text[];
  v_day integer;
  v_index integer := 0;
  v_count integer;
  v_label_where text := coalesce(nullif(btrim(p_labels[1]), ''), 'Where');
  v_label_hint text := coalesce(nullif(btrim(p_labels[2]), ''), 'Where to look (suggestion)');
  v_label_done text := coalesce(nullif(btrim(p_labels[3]), ''), 'Done when');
  v_label_stop text := coalesce(nullif(btrim(p_labels[4]), ''), 'Stop if');
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

  -- Starting a sprint saves the opportunity, also when a row already holds only its checklist progress.
  insert into public.saved_opportunities (user_id, opportunity_id, saved) values (v_user, p_opportunity, true)
  on conflict (user_id, opportunity_id) do update set saved = true;
  select coalesce(s.completed_tasks, '{}') into v_done from public.saved_opportunities s
  where s.user_id = v_user and s.opportunity_id = p_opportunity;

  if jsonb_typeof(v_payload -> 'steps') = 'array' and jsonb_array_length(v_payload -> 'steps') > 0 then
    for v_step in select e.step from jsonb_array_elements(v_payload -> 'steps') with ordinality as e(step, n) order by n limit 4 loop
      v_item := btrim(coalesce(v_step ->> 'action', ''));
      if char_length(v_item) > 0 then
        v_detail := '{}';
        -- Where: the cited source's title when it is still listed on the opportunity, otherwise the hint.
        select left(btrim(src ->> 'title'), 200) into v_where
        from jsonb_array_elements(case when jsonb_typeof(v_payload -> 'evidence') = 'array' then v_payload -> 'evidence' else '[]'::jsonb end) as src
        where src ->> 'source_key' = v_step ->> 'where' and char_length(btrim(coalesce(src ->> 'title', ''))) > 0
        limit 1;
        if v_where is not null then
          v_detail := v_detail || (v_label_where || ': ' || v_where);
        elsif char_length(btrim(coalesce(v_step ->> 'where_hint', ''))) > 0 then
          v_detail := v_detail || (v_label_hint || ': ' || btrim(v_step ->> 'where_hint'));
        end if;
        if char_length(btrim(coalesce(v_step ->> 'done_when', ''))) > 0 then
          v_detail := v_detail || (v_label_done || ': ' || btrim(v_step ->> 'done_when'));
          v_criteria := v_criteria || ('- ' || btrim(v_step ->> 'done_when'));
        end if;
        if char_length(btrim(coalesce(v_step ->> 'stop_if', ''))) > 0 then
          v_detail := v_detail || (v_label_stop || ': ' || btrim(v_step ->> 'stop_if'));
        end if;
        v_day := case when jsonb_typeof(v_step -> 'day') = 'number' then least(14, greatest(1, (v_step ->> 'day')::numeric::integer)) else 14 end;
        v_titles := v_titles || left(v_item, 300);
        v_details := v_details || left(array_to_string(v_detail, E'\n'), 1000);
        v_due := v_due || (v_started + least(p_length, greatest(1, round(p_length::numeric * v_day / 14)))::integer);
        v_ticked := v_ticked || ((p_opportunity::text || '-' || v_index::text) = any (v_done));
      end if;
      -- Ticks are stored by the step's position on the page, so the index advances for every step shown there.
      v_index := v_index + 1;
    end loop;
  end if;

  if coalesce(array_length(v_titles, 1), 0) = 0 then
    -- No next steps: the fixed first steps (at most four, as on the page), each ticked if its index was ticked before.
    v_index := 0;
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
    v_count := coalesce(array_length(v_titles, 1), 0);
    for v_index in 1 .. v_count loop
      v_details := v_details || ''::text;
      v_due := v_due || (v_started + greatest(1, round(p_length::numeric * v_index / v_count))::integer);
    end loop;
  end if;

  insert into public.validation_sprints (user_id, opportunity_id, length_days, started_on, go_criteria)
  values (v_user, p_opportunity, p_length, v_started, left(array_to_string(v_criteria, E'\n'), 1000)) returning id into v_sprint;

  v_count := coalesce(array_length(v_titles, 1), 0);
  for v_index in 1 .. v_count loop
    insert into public.validation_tasks (user_id, sprint_id, title, detail, due_on, done_at, position, origin)
    values (v_user, v_sprint, v_titles[v_index], v_details[v_index], v_due[v_index],
      case when v_ticked[v_index] then now() end, v_index - 1, 'report');
  end loop;
  return v_sprint;
end;
$$;

commit;
