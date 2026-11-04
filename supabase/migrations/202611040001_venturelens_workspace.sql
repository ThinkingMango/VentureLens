begin;

create table public.founder_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  role text not null default 'Aspiring founder' check (char_length(role) <= 100),
  industry text not null default 'Professional services' check (char_length(industry) <= 100),
  skills text not null default '' check (char_length(skills) <= 500),
  hours text not null default '10–20 hours' check (char_length(hours) <= 50),
  budget text not null default 'Under $1,000' check (char_length(budget) <= 50),
  goal text not null default 'Build a sustainable side business' check (char_length(goal) <= 150),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.research_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  sector text not null check (char_length(sector) between 1 and 100),
  model text not null check (char_length(model) between 1 and 100),
  geography text not null check (char_length(geography) between 1 and 100),
  context text not null default '' check (char_length(context) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  summary text check (char_length(summary) <= 20000),
  error_code text check (char_length(error_code) <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id,user_id) references public.research_projects(id,user_id) on delete cascade,
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  score integer not null check (score between 0 and 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 250000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id),
  foreign key (run_id,user_id) references public.research_runs(id,user_id) on delete cascade
);

create table public.saved_opportunities (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null,
  completed_tasks text[] not null default '{}' check (cardinality(completed_tasks) <= 100),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,opportunity_id),
  foreign key (opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);

create index research_projects_owner_created_idx on public.research_projects(user_id,created_at desc);
create index research_runs_owner_project_idx on public.research_runs(user_id,project_id,created_at desc);
create index opportunities_owner_run_idx on public.opportunities(user_id,run_id);
create index saved_opportunities_owner_created_idx on public.saved_opportunities(user_id,created_at desc);

create function public.set_workspace_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_workspace_updated_at() from public,anon,authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['founder_profiles','research_projects','research_runs','opportunities','saved_opportunities'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('alter table public.%I force row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',table_name || '_select_own',table_name);
    execute format('create trigger workspace_updated_at before update on public.%I for each row execute function public.set_workspace_updated_at()',table_name);
  end loop;
end;
$$;

grant insert,update,delete on public.founder_profiles,public.research_projects,public.saved_opportunities to authenticated;
create policy profiles_insert_own on public.founder_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.founder_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.founder_profiles for delete to authenticated using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.research_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.research_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy projects_delete_own on public.research_projects for delete to authenticated using ((select auth.uid()) = user_id);
create policy saves_insert_own on public.saved_opportunities for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.user_id = (select auth.uid())));
create policy saves_update_own on public.saved_opportunities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.user_id = (select auth.uid())));
create policy saves_delete_own on public.saved_opportunities for delete to authenticated using ((select auth.uid()) = user_id);

-- Research outputs are read-only to accounts; a trusted worker may write them later.
revoke insert,update,delete on public.research_runs,public.opportunities from authenticated;

create function public.initialize_founder_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.founder_profiles(user_id,name)
  values (new.id,left(coalesce(new.raw_user_meta_data ->> 'full_name',''),80))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_founder_profile() from public,anon,authenticated;
create trigger venturelens_initialize_founder_profile after insert on auth.users for each row execute function public.initialize_founder_profile();
insert into public.founder_profiles(user_id,name)
select id,left(coalesce(raw_user_meta_data ->> 'full_name',''),80) from auth.users on conflict (user_id) do nothing;

commit;
