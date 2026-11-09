begin;

-- One free research run is granted per normalised email (20261105155412), but Gmail ignores dots in the local part
-- and delivers googlemail.com to the same inbox, so a.b.c@gmail.com, abc@gmail.com and abc@googlemail.com each
-- received a run. Gmail addresses now normalise to one form. Other providers keep their dots, which can be
-- significant there. grant_signup_research_run normalises both sides when it compares, so existing grants are
-- matched too; no data changes.
create or replace function public.normalized_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select case
    when parts.domain in ('gmail.com', 'googlemail.com') then replace(parts.local, '.', '') || '@gmail.com'
    else parts.local || '@' || parts.domain
  end
  from (
    select lower(regexp_replace(split_part(p_email, '@', 1), '\+.*$', '')) as local,
           lower(split_part(p_email, '@', 2)) as domain
  ) as parts;
$$;
revoke all on function public.normalized_email(text) from public, anon, authenticated;

commit;
