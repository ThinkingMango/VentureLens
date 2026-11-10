begin;

-- WP-02 founder profile v2: what the founder is drawn to, problems they have seen up close, who they can reach, their
-- main strength, the income they are aiming for, their appetite for risk, what they will not do, and the languages
-- they work in. Every column has a default, so existing profiles stay valid and read as "not answered".
-- As with the existing columns, the database only bounds lengths; the allowed answers live in the application's
-- profileSchema (lib/workspace-schema.ts).
alter table public.founder_profiles
  add column if not exists interests text not null default '' check (char_length(interests) <= 500),
  add column if not exists pain_points text not null default '' check (char_length(pain_points) <= 500),
  add column if not exists revenue_target text not null default '' check (char_length(revenue_target) <= 50),
  add column if not exists strength text not null default '' check (char_length(strength) <= 30),
  add column if not exists distribution text not null default '' check (char_length(distribution) <= 500),
  add column if not exists languages text[] not null default '{}' check (
    cardinality(languages) <= 5
    and array_position(languages, null) is null
    and char_length(array_to_string(languages, '')) <= 200
  ),
  add column if not exists exclusions text not null default '' check (char_length(exclusions) <= 300),
  add column if not exists risk_tolerance text not null default '' check (char_length(risk_tolerance) <= 20);

-- Row-level security, policies and the table-level grants on founder_profiles are unchanged and cover the new columns:
-- founders read, insert and update only their own row.

commit;
