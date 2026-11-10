# Implementation status — VentureLens v1

Tracks the work packages in [`docs/PRODUCT_SPEC_V1.md`](./PRODUCT_SPEC_V1.md) §4, in build order. Update the row for a work package at the end of its pull request.

**Status words** (spec §9.3):
- **Implemented and tested**: merged, and the listed checks were run and passed.
- **Implemented but not verified**: merged (or ready to merge), but some behaviour was not exercised, such as a live provider, email or the production database.
- **Blocked**: waiting on an owner decision, credential or environment; the row says which.
- **Not started**

"Ran" means executed by the agent or by CI. "Reviewed" means read in the code only.

## Work packages

| Order | WP | Feature | Status | PR | What was run | Open items |
|---|---|---|---|---|---|---|
| 1 | WP-00 | Baseline, CI, status document | Implemented but not verified | [#39](https://github.com/ThinkingMango/VentureLens/pull/39) (draft) | Ran locally: install, typecheck, `pnpm test` (178/178 with a Postgres 16 test database; 175 pass + 3 skipped without one), `pnpm test:sql` (3/3), `pnpm build`. Ran in CI on GitHub: [run 42793451645](https://github.com/ThinkingMango/VentureLens/actions/runs/42793451645) at `51c65e1`, green, 178/178 with 0 skipped. See [Baseline](#baseline-wp-00) | Becomes "Implemented and tested" once #39 merges and CI passes on `main` (spec acceptance). Owner: optionally make the CI check required on `main` |
| 2 | WP-01 | Operator run inspector, quality test set, product events | Implemented but not verified | [#40](https://github.com/ThinkingMango/VentureLens/pull/40) (draft, stacked on #39) | Ran: typecheck; `pnpm test` 204/204 with a Postgres 16 database; `pnpm test:sql` 4/4; `pnpm build`; the built app against a local stand-in for Supabase (admin 200, non-admin 404, signed-out 307, no brief or profile text in any page) with screenshots at 1366 and 390 px in all three languages | Not exercised: real Supabase data, and the migration on the production project (needs owner approval). The evaluation has not been run (it costs money; D4: development project, at most $5 per session). Owner to review the privacy-policy wording. D4 and D5 decided: defaults |
| 3 | WP-06 | "No viable opportunity" explained | Implemented but not verified | [#41](https://github.com/ThinkingMango/VentureLens/pull/41) (draft, stacked on #40) | Ran: typecheck; `pnpm test` 219/219 with a Postgres 16 database; `pnpm test:sql` 4/4; `pnpm build`; the built app against a local stand-in for Supabase (run page explanation, `?from=` prefill limited to the founder's own runs, demo page and history entry), with screenshots in en, zh-Hans and zh-Hant at 1366 and 390 px | Not exercised: a real `INSUFFICIENT_EVIDENCE` run (needs a paid run). "Verify one of these ideas" is held until WP-05. D3 decided: default (slot release unchanged) |
| 4 | WP-05 | Verify my idea | Not started | — | — | Decisions D2 (verify run uses one slot), D8 (time-expectation copy) |
| 5 | WP-02 | Founder profile v2 + starter profiles | Not started | — | — | — |
| 6 | WP-03 | Run focus: angles and "explore something new" | Not started | — | — | Needs WP-02; "explore new" needs WP-04 |
| 7 | WP-04 | Memory across runs and dedupe | Not started | — | — | — |
| 8 | WP-07 | Claim-level citations (methodology v3) | Not started | — | — | See observation 4 (methodology label) |
| 9 | WP-09 | Opportunity page parity + reading guide | Not started | — | — | Needs WP-07 |
| 10 | WP-13 | Flag a claim, rate a report | Not started | — | — | Needs WP-07, WP-09 |
| 11 | WP-08 | Live progress + "report ready" email | Not started | — | — | Decision D1 (email provider and sender); D7 (repository visibility) is due before this WP |
| 12 | WP-10 | Validation sprint workspace v1 | Not started | — | — | Needs WP-09 |
| 13 | WP-11 | Report export: Markdown + print-to-PDF | Not started | — | — | Needs WP-07 |
| 14 | WP-12 | Library: archive, undo, filters, delete | Not started | — | — | Decision D6 (usage rows on run deletion) |

Owner decisions D1–D8 are listed in spec §8. Decided so far, all at their suggested defaults on 2026-11-10: **D3** (runs that fail with `INSUFFICIENT_EVIDENCE` keep releasing their slot as today), **D4** (quality evaluation runs on a development project, at most $5 per session) and **D5** (the run inspector shows structural data only).

## Baseline (WP-00)

Run on 2026-11-10 at `51c65e1`, which is `main` at `2510a3b` plus the CI workflow and documentation from #39 (no application code changed). Node 22.23.4, pnpm 10.28.0, no `.env` files and no Supabase or provider variables in the environment.

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Ran: OK. pnpm prints a warning that it ignored the build scripts of `@parcel/watcher`, `@swc/core`, `cbor-extract` and `esbuild`; typecheck, tests and build pass regardless |
| `pnpm typecheck` | Ran: OK, no errors |
| `pnpm test` without `TEST_DATABASE_URL` | Ran: 178 tests, 175 pass, 0 fail, 3 skipped (the SQL tests skip without a database) |
| `pnpm test` with `TEST_DATABASE_URL` (local PostgreSQL 16.15) | Ran: 178 tests, 178 pass, 0 fail, 0 skipped |
| `pnpm test:sql` (same database) | Ran: 3 tests, 3 pass |
| `pnpm build` | Ran: OK in about 27 s; 27 routes plus the proxy. Succeeds with no Supabase or provider keys, so CI needs no placeholder values |
| `pnpm test:integration` | Not run: needs Supabase credentials and a test project |
| `pnpm test:research:e2e` | Not run: real provider spend; needs owner approval |

## CI

`.github/workflows/ci.yml` runs on every pull request, every push to `main`, and on demand. It uses one job, *Typecheck, test and build*:

1. Node 22 and pnpm from `packageManager`.
2. `pnpm install --frozen-lockfile`.
3. A `psql` check that a `postgres:16` service container is reachable.
4. `pnpm typecheck`.
5. `pnpm test`, with `TEST_DATABASE_URL` set so the SQL tests run instead of skipping.
6. `pnpm build`.

It uses no secrets.

## Observations recorded during WP-00

1. **Spec §2.2 said there was no CI (`.github/` absent).** #39 adds it.
2. **The migrations doc is missing the newest migration.** The applied-history table in [`DATABASE_MIGRATIONS.md`](./DATABASE_MIGRATIONS.md) ends at `20261109160000`; `supabase/migrations/20261110025844_multi_choice_brief.sql` is not listed. The commit "Name the brief migration after the version production recorded" (`f9aad97`) suggests production has it. Not verified: this session has no access to the production project. **Owner:** confirm, and add the row with its content check.
3. **The SQL tests skip silently without a database.** All three SQL test files skip themselves and report success when `TEST_DATABASE_URL` or `psql` is missing. CI therefore checks that the database is reachable before running them.
4. **Two different methodology labels.** `enqueue_research` (latest version in `20261110025844_multi_choice_brief.sql`) stores `methodology: 'evidence-driven-v1'` in `research_runs.configuration`. The engine writes `methodology: 'evidence-driven-v2'` into the setup checkpoint and the report (`lib/research-core.ts`). Reports therefore carry the right label, but the run configuration doesn't. This is relevant to WP-07 (methodology v3): reviewed only, nothing changed.
