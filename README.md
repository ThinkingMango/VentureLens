# VentureLens AI

Evidence-first opportunity research for founders exploring GenAI-enabled, recurring-revenue businesses.

A founder describes their experience, constraints and goals; VentureLens discovers narrow opportunity hypotheses, retrieves real web evidence for each one, classifies and scores it, runs an adversarial review, and saves a private report with linked sources and a validation plan. Candidates without independent evidence are dropped rather than dressed up.

- **Live app routes:** `/`, `/pricing`, `/privacy`, `/support`, `/login`, `/signup`, `/onboarding`, `/dashboard`, `/research`, `/research/new`, `/research/[id]`, `/research/results`, `/opportunities/[id]`, `/saved`, `/profile`, `/billing`, `/admin`
- **Contact:** product help at `support@smartmango.ai`, privacy and data requests at `privacy@smartmango.ai` (`lib/contact.ts`). The Privacy Policy (`components/privacy.tsx`) describes the real data flows. Its AI-provider paragraphs, processor list and international-transfer clause, and the Support page's "Which AI model runs my research?" answer, are generated on every request from the research policy in `public.app_settings` (`lib/provider-disclosure.ts`), so saving a change at `/admin` updates them immediately; if the policy cannot be read they disclose every provider. Update the static text and `privacyUpdatedAt` whenever a cookie, stored field, or non-AI processor changes.
- **Synthetic demo:** everything under `/demo/*` runs on fixed fixtures with no account and no AI calls.
- **Languages:** English, Simplified Chinese, Traditional Chinese (interface). Source excerpts are kept in their original language.
- **Status:** beta. Every confirmed account receives one free research run (`research_dev_access`, granted by a database trigger); failed runs are returned automatically (failures on our side and runs that spent nothing always; other failed runs up to `max_refunds` per account, default 3); payments are not connected. See [`plan.md`](./plan.md) for the roadmap and [`docs/REVIEW.md`](./docs/REVIEW.md) for the November 2026 holistic review (a historical snapshot; §8 there records what has since been fixed).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn-style primitives |
| Data & auth | Supabase (Postgres, RLS, passwordless email OTP / magic link) |
| Research job | Vercel Workflow (`workflows/research.ts`) with checkpointed stages |
| Models | Qwen via DashScope (primary) and Gemini (fallback) through the Vercel AI SDK; native web search on both |
| i18n | `next-intl`; messages keyed by a hash of the English source string (`i18n/config.ts` → `messageKey`) |
| Tests | `node:test` unit tests, a Supabase integration test, and a research E2E test |

## Local setup

Prerequisites: Node 22, pnpm 10, a Supabase project (or the Supabase CLI), and optionally DashScope / Google AI keys.

```bash
pnpm install --frozen-lockfile
```

Create `.env.development.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<service role / secret key>      # server only
# Live research (optional; the demo works without these)
DASHSCOPE_API_KEY=<key>
DASHSCOPE_WORKSPACE_ID=<beijing workspace id>
GOOGLE_GENERATIVE_AI_API_KEY=<key>
# Optional: idempotent workflow dispatch through start hooks (dispatch works without it)
WORKFLOW_VERCEL_EXPERIMENTAL_START_HOOK=1
```

Apply the migrations in `supabase/migrations/` to your project, then:

```bash
pnpm dev
```

Migration versions match the live project's history; see [`docs/DATABASE_MIGRATIONS.md`](./docs/DATABASE_MIGRATIONS.md) before adding one.

Email templates for the passwordless flow live in `supabase/templates/` with setup notes in that folder's README.

Every confirmed account receives one free research run automatically. To give an account more during the beta, raise its grant (`max_runs` is bounded 1–100):

```sql
update public.research_dev_access set max_runs = 20, expires_at = now() + interval '30 days'
where user_id = '<auth.users.id>';
```

A failed run hands its slot back when the failure was on our side (dispatch, workflow, provider outage, configuration or credits) or when it spent nothing. Any other failed run, such as one whose evidence was too thin, is returned only while `runs_refunded < max_refunds` (default 3, bounded 0–100), so one account cannot start paid runs without limit. A failed run that keeps its slot can still be retried at no extra cost. Raise `max_refunds` for an account the same way as `max_runs`.

## Administrators and settings

Administrator access is granted only by a server-managed claim in `app_metadata`, set with the service role or in the Supabase dashboard: `app_metadata.role = "admin"` (use this one), or the legacy `app_metadata.is_admin = true`, which `lib/admin-access.ts` still accepts. Either also requires a confirmed email; no email address is special, and `user_metadata` never grants access. Administrators manage the research policy (primary provider, fallback, models, per-run budget cap) at `/admin`, which is stored in the service-role-only `public.app_settings` table under the key `research`. The page shows what a complete run is expected to cost and refuses a primary model that the per-run budget cannot pay for. At the $0.25 default only Qwen 3.8 Flash can finish a run; Gemini Flash-Lite needs about $0.40 because Google Search grounding is billed per query. See [`docs/GENERATION_PIPELINE_REVIEW.md`](./docs/GENERATION_PIPELINE_REVIEW.md).

```sql
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'
where id = '<auth.users.id>';
```

## Scripts

```bash
pnpm dev                 # Next.js dev server
pnpm typecheck           # tsc --noEmit
pnpm test                # unit tests (no network)
pnpm build               # production build
pnpm test:integration    # Supabase RLS/integration test — needs credentials and a test project
pnpm test:research:e2e   # runs a real research job — incurs provider cost
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
                         # runs every migration on a throwaway database and tests the run-quota SQL
```

CI (`.github/workflows/ci.yml`) runs `pnpm typecheck`, `pnpm test` (including the SQL tests, against a PostgreSQL 16 service) and `pnpm build` on every pull request and every push to `main`. It needs no secrets; `test:integration` and `test:research:e2e` stay manual because they need credentials and incur provider cost.

## Repository layout

```
app/              routes (public, (workspace) group, /demo, /api, /auth)
components/       screens and UI primitives (components/ui)
lib/              research engine, providers, workspace data, schemas, Supabase clients
workflows/        Vercel Workflow definition for a research run
supabase/         migrations and auth email templates
i18n/, messages/  locale negotiation, copy helpers, catalogues (en, zh-Hans, zh-Hant)
tests/            node:test suites
docs/             reviews and operating documentation
```

## How a research run works

1. `POST /api/research` validates the brief, checks the profile and access grant, and calls `enqueue_research` (idempotent on `requestKey`).
2. `dispatchResearch` starts the workflow; `initializeResearch` claims the run and verifies the provider.
3. Stages run in order with a checkpoint after each: `discovery` → `retrieval:cN` (one per candidate) → `classification` → `evaluation` → `scoring` → `review` → `finalizing`.
4. Before the first request, `initializeResearch` checks that the configured models can finish a run within its budget (`lib/research-budget.ts`); if none can, the run stops uncharged. Every model or search call then reserves budget through `reserve_research_usage`; the run stops with `BUDGET_EXCEEDED` if a reservation does not fit.
   Models answer against lenient draft schemas that the server normalises (`lib/research-core.ts`), so a length overrun or a skipped id no longer fails a run; a hypothesis whose search finds nothing is skipped.
5. `finish_research` writes the report and `opportunities` rows only when at least one candidate survives the evidence gate (supporting sources from two independent domains, one of them non-vendor pain or demand evidence) and the review. Contradicting and neutral sources are saved with their stance and shown as counter-evidence, but never help a candidate pass, and confidence and the score cap follow independent supporting domains only.

The report is written in the language recorded on the run (`configuration.brief.language`, defaulting to the interface language at submission). Source excerpts are always kept verbatim in their original language.

Scoring rules live in `lib/research-core.ts` and are unit-tested in `tests/research.test.mjs`.

## Adding UI copy

Call `copy("English source text")` in components. Then add the string to all three catalogues with `node scripts/i18n-merge.mjs entries.json`, where `entries.json` lists `{ "en", "hans", "hant" }` objects; the key is produced by `messageKey()`. `pnpm test` fails if a literal `copy()` call has no entry in any locale. Strings passed through variables (arrays of titles, etc.) are not checked by the test, so add them too.

## Contributing

- Keep `/demo` fixtures separate from real data; never write demo content into Supabase.
- New tables need RLS with `force row level security`, composite `(id, user_id)` foreign keys, and tests.
- Do not add payment or billing logic until the entitlement ledger described in `plan.md` M3 exists.
