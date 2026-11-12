begin;

-- New accounts get 10 free research runs, valid for 90 days (owner decision, 2026-11-11). Until now a confirmed
-- address received 1 run for 30 days (20261105155412). Everything else about the grant is unchanged: it is made once,
-- when the address is confirmed; smartmango.ai addresses are granted by hand; and one normalised email
-- (normalized_email, 20261109160000) receives it once, so Gmail dots, +tags and googlemail.com cannot claim it again.
-- Existing grants are not changed by this migration.
create or replace function public.grant_signup_research_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  if lower(split_part(new.email, '@', 2)) = 'smartmango.ai' then return new; end if;
  if exists (select 1 from public.research_dev_access a where a.user_id = new.id) then return new; end if;
  if exists (
    select 1 from public.research_dev_access a
    join auth.users u on u.id = a.user_id
    where a.source = 'signup' and u.id <> new.id
      and public.normalized_email(u.email) = public.normalized_email(new.email)
  ) then return new; end if;
  insert into public.research_dev_access (user_id, expires_at, max_runs, source)
  values (new.id, now() + interval '90 days', 10, 'signup')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

commit;
