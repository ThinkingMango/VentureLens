# VentureLens v1 — Product & Build Specification

> **Purpose:** the build specification for VentureLens v1. It combines VentureLens's evidence engine with the strongest user-facing features of PocketFounder, its sister product.
> **Audience:** a coding agent (Claude Code) working **inside the `ThinkingMango/VentureLens` repository**, and the owner who reviews its pull requests.
> **Prepared:** 2026-11-10, from a full source read of VentureLens `main` at `9f1c9d0` and of PocketFounder (`ThinkingMango/PocketFounder-Monetised`).
> **Scope:** product features only. **Pricing, payments, Stripe and credit packs are out of scope.** Do not add billing logic. Keep the existing run-access model (`research_dev_access`, one free run per confirmed account, failed-run release) unchanged unless a work package says otherwise.
> **Status of this document:** a plan, not a record of execution. Statements about the current code were true at `9f1c9d0`. Anything marked **VERIFY** must be checked in the repository before you rely on it.

---

## 0. How to use this document (instructions for the coding agent)

1. **Read before you write:**
   - `AGENTS.md`: the Next.js version is newer than your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing route, layout, server action or caching code.
   - `README.md`, `plan.md`, `docs/REVIEW.md`, `docs/GENERATION_PIPELINE_REVIEW.md`, `docs/DATABASE_MIGRATIONS.md`.
   - The files listed under each work package.
2. **Work one package at a time, in the order in §4.** Each work package (WP) is one branch and one pull request unless it says otherwise.
3. **Before starting a WP,** re-read its "Design" section against the code. If the code differs from what this spec assumes, follow the code. Note the difference in the PR description and in `docs/IMPLEMENTATION_STATUS.md`.
4. **At the end of every WP:**
   - run `pnpm typecheck`, `pnpm test` and `pnpm build`;
   - update `docs/IMPLEMENTATION_STATUS.md` using the status words in §9.3;
   - list in the PR what was **run** and what was only **code-reviewed**.
5. **Stop and ask the owner** when you hit an item in §8 (Owner decisions), or before anything that:
   - changes the production database outside a reviewed migration;
   - sends real provider requests that cost money;
   - sends real email to users.
6. **Never** weaken the evidence gate, the score caps, row-level security, or demo isolation to make a feature easier.

---

## 1. Product definition

### 1.1 One sentence

VentureLens helps a founder go from *"what should I build?"* or *"is my idea real?"* to **evidence that real buyers have the problem and will pay**, and then helps them collect that evidence themselves.

### 1.2 Principles (non-negotiable product rules)

1. **Checkable, not convincing.** Every important claim links to a source or is labelled an assumption.
2. **Evidence gate stays.** An opportunity is shown as viable only with supporting sources from ≥2 independent registrable domains, at least one non-vendor, as enforced by `evidenceGate()` in `lib/research-core.ts`.
3. **Scores are not probabilities.** They are capped (70 / 85), explained, and never presented as a chance of success.
4. **A null result is a result.** "Nothing passed, and here is why" is a valid, useful output.
5. **Real-world evidence beats web evidence.** The product's long-term job is to help the founder gather first-hand evidence: interviews, sign-ups, payments.
6. **Old reports stay readable** under the methodology they were produced with.
7. **Three languages:** English, Simplified Chinese, Traditional Chinese for the interface and the report. Source quotes are always kept verbatim in their original language.

### 1.3 Main success measure

**The share of active users who record at least one real-world validation action within 30 days of their first report.** In v1 that means a completed validation task. Later (Next backlog) it will be a logged interview, sign-up or payment.

### 1.4 Non-goals for v1

- Billing, credit packs, subscriptions, Stripe.
- A general chatbot.
- Revenue forecasts presented as predictions, or success probabilities.
- Pitch decks or investor tools.
- A website builder.
- Co-founder matching or a marketplace.
- Gamification: streaks, badges, fake social proof.

---

## 2. Current state of the repository (VERIFY before relying on it)

### 2.1 What already exists and must be preserved

| Area | Where | Notes |
|---|---|---|
| Founder profile | `founder_profiles` table; `profileSchema` in `lib/workspace-schema.ts`; `components/onboarding.tsx`; `/profile` | Fields: name, role, industry, skills, hours (enum), budget (enum), goal |
| Research brief | `research_projects` table; `projectSchema` / `briefShape` in `lib/workspace-schema.ts`; `components/research-config.tsx` | Fields: name, sectors[], models[], geography, context (≤1000 chars), discovery_mode (`founder` / `market` / `combined`) |
| Research workflow | `workflows/research.ts` | `initialize` → `discovery` → `retrieval:<key>` for each candidate → `classification` → `evaluation` → `scoring` → `review` → `finalizing`. Checkpoints in `research_stages`. A stage retries once on platform failure |
| Engine | `lib/research-engine.ts` (stage prompts, `structured`, `providerCall`, `retrieve`), `lib/research-core.ts` (schemas, normalisers, `evidenceGate`, `scoreParts`, `scoringWeights`, `researchPolicy`) | Discovery asks for 8 candidates; `discoverySchema` requires 5–8 |
| Budget control | `lib/research-budget.ts` (`reservationFor`, `estimateRunCost`), `reserve_research_usage` RPC, `research_usage` table | Budget per run held in `app_settings` (`research` row) |
| Run access | `research_dev_access`; triggers `grant_signup_research_run`, `release_failed_research_run`; RPCs `enqueue_research`, `retry_research` | Failed runs release their slot (our faults always; others up to `max_refunds`) |
| Results | `opportunities` (payload JSON validated by `opportunitySchema`), `research_evidence`, report on `research_runs` | `opportunitySchema.scores` is fixed at length 5 |
| Saved and validation | `saved_opportunities (completed_tasks text[], notes)` | Basic task ticking |
| Errors | Codes in use: `INSUFFICIENT_EVIDENCE`, `INVALID_OUTPUT`, `RETRIEVAL_UNAVAILABLE`, `BUDGET_EXCEEDED`, `WORKFLOW_INTERRUPTED`, `PROVIDER_CONFIGURATION`, `PROVIDER_CREDITS_REQUIRED`, `RESEARCH_INPUT_TOO_LARGE` | |
| Admin | `/admin` (provider policy, budget, cost estimate); `lib/admin-access.ts` (`app_metadata.role = "admin"`) | |
| Demo | `/demo/*`, `lib/demo-data.ts`, `components/demo-*` | Fixed data only; must never mix with real data |
| i18n | `copy("English source")` + `scripts/i18n-merge.mjs` → `messages/{en,zh-Hans,zh-Hant}.json` | `pnpm test` fails if a literal `copy()` has no entry |
| Tests | `node --experimental-strip-types --test …` with an **explicit file list in `package.json` → `scripts.test`** | New test files must be added to that list |

### 2.2 Known gaps this spec addresses

- No way to research an idea the user already has.
- A run with zero surviving opportunities ends as `INSUFFICIENT_EVIDENCE` with no useful explanation.
- No memory across runs: discovery sees only the current brief and profile.
- Claims are not linked to individual sources.
- The live opportunity page is less complete than the demo page.
- Real reports cannot be exported.
- No completion notification, although runs take about 5 minutes.
- Validation tracking is only a list of ticked task strings.
- No user feedback on report quality.
- No quality test set or run inspector for the operator.
- No CI (`.github/` is absent).

---

## 3. Engineering guardrails (apply to every work package)

### 3.1 Database
- **New migration files only.** Never edit an applied migration. Follow `docs/DATABASE_MIGRATIONS.md`: write the file first, apply it with the same name, and copy the assigned version into the file name if `apply_migration` is used.
- Every new user-owned table must have:
  - `enable` + `force row level security`;
  - composite foreign keys `(id, user_id)` to its parents;
  - `revoke all … from anon, authenticated`, then explicit `grant` statements;
  - `select` / `insert` / `update` / `delete` policies with `USING` and `WITH CHECK` scoped to `auth.uid()`.
- Writes that must be atomic or privileged go through `security definer` functions with `set search_path = ''`, matching the existing RPCs.
- **Business parameters live in `public.app_settings`, not in check constraints.**
- Add SQL tests where behaviour lives in SQL, following `tests/*.sql.test.mjs`.
- Do **not** apply migrations to the production project (`ndrxywlouwigawhgrtrj`) without owner approval. Use a development project or a disposable database (`pnpm test:sql`).

### 3.2 Research engine
- Keep the stage and checkpoint structure. A new stage must be idempotent and must return its cached checkpoint when re-run.
- Every provider call goes through `providerCall` / `structured` so it is budgeted and metered. **No unmetered model calls.**
- Models answer against lenient draft schemas and **server-side normalisers** enforce the rules (`normalize*` in `lib/research-core.ts`). Add normalisers rather than strict model-facing schemas.
- Any change to scoring or gating is a **methodology version bump**: record the version on new output and keep old payloads valid.
- Prompt text treats the brief, profile, web pages and earlier model output as **untrusted data**. Keep that sentence in every new prompt.
- Re-estimate run cost (`estimateRunCost`) whenever a WP changes the number or size of calls. The admin page must still refuse policies the budget cannot pay for.

### 3.3 Frontend
- All UI text goes through `copy("English source")`, with entries added to all three catalogues via `scripts/i18n-merge.mjs`.
- Reuse the existing design system (`app/globals.css` tokens, `components/ui/*`). Keep 44 px tap targets, focus management, `aria-live` on progress, and support for reduced motion.
- Demo pages must get the same feature where it applies, using fixed data, and must never call the API.

### 3.4 Testing and verification
- Unit-test every pure function you add (normalisers, diagnostics, export builders, dedupe).
- Add each new test file to `package.json → scripts.test`.
- **Never** run `pnpm test:research:e2e` or the quality evaluation (WP-01) against production, or without the owner's cost approval.
- Report honestly: "implemented and tested", "implemented but not verified", "blocked", or "not started".

---

## 4. Work packages: overview and order

| Order | WP | Feature (feature-list number) | Depends on | Size* |
|---|---|---|---|---|
| 1 | **WP-00** | Baseline, CI, status document | — | S |
| 2 | **WP-01** | Operator run inspector + quality test set + product events (#42, #43) | WP-00 | M |
| 3 | **WP-06** | "No viable opportunity" explained (#16) | WP-00 | M |
| 4 | **WP-05** | **Verify my idea** (#5) | WP-06 | L |
| 5 | **WP-02** | Founder profile v2 + starter profiles (#1, #2) | WP-00 | M |
| 6 | **WP-03** | Run focus: angles and "explore something new" (#7) | WP-02, WP-04 for "explore new" | S |
| 7 | **WP-04** | Memory across runs and dedupe (#8) | WP-00 | M |
| 8 | **WP-07** | Claim-level citations, methodology v3 (#11) | WP-06 | M |
| 9 | **WP-09** | Opportunity page parity + reading guide (#18, #17) | WP-07 | M |
| 10 | **WP-13** | Flag a claim + rate a report (#38) | WP-07, WP-09 | S |
| 11 | **WP-08** | Live progress + "report ready" email (#13, #14) | Owner decision D1 | M |
| 12 | **WP-10** | Validation sprint workspace v1 (#23) | WP-09 | L |
| 13 | **WP-11** | Report export: Markdown + print-to-PDF (#30) | WP-07 | S |
| 14 | **WP-12** | Library: archive, undo, filters, delete (#33) | WP-00 | S |

\*Size guide: S ≈ ≤1 day, M ≈ 1–3 days, L ≈ 3–5 days, for an agent plus owner review.

WP-03 and WP-04 can be done together. WP-11 and WP-12 are independent and can run in parallel with WP-10.

---

## 5. Work packages in detail

### WP-00 — Baseline, CI and status document

**Goal:** a known-good starting point and automated checks on every pull request.

**Tasks**
1. `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Record the results.
2. Add `.github/workflows/ci.yml`:
   - Node 22 and pnpm 10;
   - `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build`;
   - no secrets, so the build must succeed without provider keys. **VERIFY** this, and if it doesn't, use placeholder public env values;
   - optional second job: `pnpm test:sql` against a Postgres service container with `TEST_DATABASE_URL`.
3. Create `docs/IMPLEMENTATION_STATUS.md`: a table with one row per WP in this spec, with status, PR link, what was run, and open items.
4. (Done when this spec was committed.) This spec lives at `docs/PRODUCT_SPEC_V1.md` and the kickoff prompt at `docs/BUILD_KICKOFF.md`.

**Acceptance**
- [ ] CI runs on pull requests and passes on `main`.
- [ ] The status document exists with every WP listed as "Not started", except WP-00.

---

### WP-01 — Operator run inspector, quality test set, product events

**Why:** VentureLens's first three production runs produced 5, 2 and 0 opportunities. Engine changes in later WPs must be measured, not guessed.

#### 1. Run inspector (admin only)
- Routes `/admin/runs` and `/admin/runs/[id]`, guarded by `isAdministrator` (`lib/admin-access.ts`), reading with the service-role client on the server only.
- **List view:** recent runs with status, stage reached, error code, mode, language, duration, committed cost (sum of `research_usage`), number of opportunities. Filters: status, error code, date range.
- **Detail view:**
  - stage timeline from `research_stages` (key, created_at, size of output);
  - the stored failure checkpoint;
  - usage rows (stage, model, reserved vs committed, status);
  - for each candidate: query, number of sources, independent supporting domains, vendor share, and gate result (use WP-06's `diagnoseCandidates()` once it exists);
  - provider switches.
- **Never** show user profile text or brief text to admins beyond what is needed. **VERIFY** the privacy policy allows operator access for support; if unclear, show only structural data and ask the owner (decision D5).

#### 2. Quality metrics (admin section `/admin/quality`)
Calculated from existing tables over a chosen window (7 / 30 / 90 days):

| Metric | Definition |
|---|---|
| Completion rate | completed ÷ (completed + failed), excluding runs stopped by the pre-flight budget check |
| Insufficient-evidence rate | failed with `INSUFFICIENT_EVIDENCE` ÷ all finished runs |
| Opportunities per completed run | mean and distribution |
| Independent supporting domains per opportunity | median |
| Vendor share of sources | sources classified `vendor` ÷ all classified sources |
| Median and p95 duration | from `started_at` to `completed_at` |
| Cost per completed run; cost per surviving opportunity | from `research_usage` |

#### 3. Quality test set (offline, owner-approved spend only)
- `tests/fixtures/eval-briefs.json`: 20–30 fixed briefs covering all modes, three languages, at least 6 geographies, and 5 "verify my idea" inputs (added after WP-05).
- `scripts/research-eval.mjs`:
  - runs the briefs against a **development** project through the normal API or workflow;
  - requires the `--confirm-cost` flag and a `--max-usd` cap, and stops when the cap is reached;
  - writes `docs/eval/<date>-<git-sha>.json` plus a short Markdown summary with the metrics above per brief and overall.
- Document in the README how to run it and that it costs money.

#### 4. Product events (non-commercial)
- Table `public.product_events (id uuid pk, user_id uuid null references auth.users on delete set null, event text, props jsonb ≤ 8 KB, created_at timestamptz)`. RLS on, insert only through a `security definer` function or the service role, no select for users.
- Server-side helper `lib/events.ts` → `track(event, { userId, props })`. Fire-and-forget; never throws; no personal data in `props`.
- Events used by later WPs: `run_started {mode, language}`, `run_finished {status, error_code, opportunities}`, `verify_started`, `outcome_viewed`, `report_exported {format}`, `sprint_created {length}`, `task_completed`, `claim_flagged {reason}`, `report_rated {rating}`, `starter_profile_used {id}`.
- Porting reference: PocketFounder `lib/analytics.ts` (fire-and-forget pattern, props size cap). Do not port IP hashing; it isn't needed here.

**Acceptance**
- [ ] Admin pages render for an admin and return 404 or a redirect for everyone else (tested).
- [ ] Each metric has a unit-tested pure calculation over fixed sample rows.
- [ ] The evaluation script refuses to run without `--confirm-cost` and `--max-usd` (tested).
- [ ] `product_events` cannot be read or written directly by `authenticated` users (SQL test).

---

### WP-06 — "No viable opportunity" explained

**Why:** a run where nothing passes the gate currently ends as a bare failure. It should instead tell the founder what was searched, what was found, why nothing passed, and what to try next.

**Design**
1. **Pure diagnostics** in `lib/research-core.ts`:
   ```ts
   type GateReason = 'NO_SOURCES' | 'SEARCH_FAILED' | 'SINGLE_DOMAIN' | 'VENDOR_ONLY'
                   | 'CONTRADICTED' | 'REVIEW_REJECTED' | 'PASSED';
   export function diagnoseCandidates(input: {
     candidates: Candidate[]; evidence: Evidence[]; classifications: Classification[];
     reviews?: Review[]; retrievalFailures?: string[];   // candidate keys whose search failed
   }): Array<{
     key: string; title: string; buyer: string; query: string;
     sources: Array<{ url: string; domain: string; reliability: string; stance: string }>;
     supportingDomains: number; nonVendorSupport: boolean; contradicting: number;
     reason: GateReason;
   }>;
   export function outcomeSuggestions(reasons: GateReason[], mode: Mode): SuggestionKey[];
   ```
   - The reason is the **first** failing rule, in the order the gate applies them. **VERIFY** the order in `evidenceGate()` and mirror it exactly; never re-implement the gate differently.
   - Suggestions are **deterministic keys**, translated in the UI and never written by the model. Examples:
     - `TRY_MARKET_MODE` when most candidates are `VENDOR_ONLY` in founder mode;
     - `NARROW_BUYER` when results are `SINGLE_DOMAIN`;
     - `CHANGE_GEOGRAPHY` when results are `NO_SOURCES`;
     - `VERIFY_SPECIFIC_IDEA` always.
2. **Persist** the diagnostics as a checkpoint in `research_stages` with `stage_key = 'outcome'`:
   - written in `finalizing` for **completed** runs, so the report can show "candidates that did not pass";
   - written in the `INSUFFICIENT_EVIDENCE` path **before** the run is marked failed.
   - It must be idempotent: if an `outcome` row exists, keep it. **VERIFY** the `research_stages` unique key and the user's select policy. If users cannot read `research_stages`, expose the outcome through `researchDetail()` with server-side reads.
3. **No change to run-access rules.** An `INSUFFICIENT_EVIDENCE` run still releases its slot exactly as today (decision D3).
4. **UI** on `/research/[id]` (`components/research-run.tsx` / `components/research-report.tsx`):
   - For failed `INSUFFICIENT_EVIDENCE` runs, a section **"What we looked for, and why nothing passed"**:
     - a summary line ("8 ideas searched · 31 sources read · 0 passed");
     - one row per candidate with title, buyer, plain-language reason, and its sources as links with reliability and stance chips;
     - suggestion buttons: "Edit the brief and run again" (prefilled `/research/new`) and "Verify one of these ideas" (after WP-05, prefilled verify form).
   - For completed runs, a collapsed section "Ideas that did not pass the evidence rules (n)".
   - The demo gets one fixed example of this outcome.
5. Event `outcome_viewed {reasonCounts}`.

**Files:** `lib/research-core.ts`, `lib/research-engine.ts` (finalizing and insufficient-evidence path), `lib/research-service.ts` (`researchDetail`), `lib/research-types.ts`, `components/research-run.tsx`, `components/research-report.tsx`, `lib/demo-data.ts`, messages.

**Tests:** `tests/outcome.test.mjs`. One case per reason; the ordering matches `evidenceGate`; vendor-only plus a contradicting source gives `VENDOR_ONLY`; deterministic suggestions; idempotent checkpoint write (mock client).

**Acceptance**
- [ ] A run that fails with `INSUFFICIENT_EVIDENCE` shows per-candidate reasons and sources in all three languages.
- [ ] Completed runs list the candidates that didn't pass.
- [ ] `diagnoseCandidates` agrees with `evidenceGate` on every test fixture (shared fixtures).
- [ ] No change to quota behaviour (existing SQL tests still pass).

---

### WP-05 — Verify my idea

**Why:** both products assume the user has no idea yet. Many users already have one. A single-idea run is cheaper, quicker to understand, and always produces a verdict.

**User stories**
- As a founder with an idea, I can describe it (what, for whom, what problem) and get evidence for and against it.
- I always receive a verdict:
  - **Supported:** passed the gate, with a capped score;
  - **Not yet supported:** didn't pass, with the reasons and sources from WP-06.

**Design**
1. **Brief:** add `discovery_mode: "verify"` and an `idea` object to `briefShape`:
   ```ts
   idea: z.object({
     title: z.string().trim().min(3).max(180),
     buyer: z.string().trim().min(3).max(300),
     pain:  z.string().trim().min(10).max(800),
     offer: z.string().trim().max(800).default(""),
     price_hint: z.string().trim().max(100).default(""),
   }).optional()
   ```
   - Rule (`superRefine`): `idea` is required when the mode is `verify`, and forbidden otherwise.
   - `sectors`, `models` and `geography` stay. Geography still drives search language.
   - **Database:** `research_projects.discovery_mode` has a check constraint (`founder`, `market`, `combined`). Add a migration that drops and re-adds it with `verify`. **VERIFY** whether `enqueue_research` or `sync_research_project_choices` (latest: `20261110025844_multi_choice_brief.sql`) validate the mode or brief keys. If they do, extend them in the same migration and add SQL tests.
2. **Discovery for verify mode** (`executeResearchStage`, key `discovery`):
   - Build exactly one candidate `c1` from the user's idea. Title, buyer and pain are **copied from the user's input**; the model never rewrites them.
   - One small `structured` call writes **two** search queries in the search language: `query` (evidence of the problem and existing spending, same rules as today) and `query_alt` (evidence of alternatives buyers already use or pay for, without naming products the user didn't name).
   - Store the result through a verify-specific normaliser. `discoverySchema` currently requires 5–8 candidates. Add `verifyDiscoverySchema` (exactly 1 candidate, with `query_alt`) and choose the schema by mode when reading the checkpoint. Do **not** loosen the schema for other modes.
3. **Retrieval:** the workflow loops over the keys discovery returns, so verify mode returns `['c1']`. Inside `retrieval:c1`, run **two** searches (`query`, `query_alt`), each budgeted through `providerCall`, then merge and dedupe sources by URL. A failure of one search doesn't fail the stage.
4. **Classification → review:** unchanged, with one candidate. Scoring weights for verify mode equal the `combined` weights, so add `verify` to `scoringWeights`. Methodology: record `mode: "verify"` on the report.
5. **Outcome:**
   - Passed: the normal report with one opportunity, and a verdict banner "Supported by independent evidence (moderate / limited confidence)".
   - Not passed: `INSUFFICIENT_EVIDENCE` plus WP-06's explanation, with the verdict banner "Not yet supported by independent evidence" and what would change that.
6. **Cost:** extend `estimateRunCost` with a `mode` parameter (verify = 1 structured discovery call + 2 searches + 1 batch each of classification, evaluation and review). The admin page shows both estimates. **Run access:** one verify run uses one run slot, like any run (decision D2).
7. **UI:**
   - `/research/new` starts with a choice of two large cards: **"I have an idea — check it"** and **"Find opportunities for me"**.
   - The verify form fields are: idea title, who buys it, the problem it solves, what you'd offer (optional), price you have in mind (optional), geography, and focus/context. It shows the cost and time expectation (about 2–3 minutes; **VERIFY** after the first real runs).
   - Dashboard: a "Check an idea" call to action.
   - WP-06 "Verify one of these" buttons prefill the form from a candidate.
   - Demo: one fixed verify example.
8. Events: `verify_started`, and `run_finished` with `mode: "verify"`.

**Files:** `lib/workspace-schema.ts`, `lib/research-core.ts`, `lib/research-engine.ts`, `lib/research-budget.ts`, `workflows/research.ts` (likely unchanged; **VERIFY**), `app/api/research/route.ts`, `components/research-config.tsx`, `components/admin-providers.tsx`, a new migration, messages, demo.

**Tests:**
- schema: idea required only for verify;
- verify normaliser keeps the user's text unchanged;
- merging two searches dedupes by URL;
- cost estimate for verify is below combined;
- SQL: `discovery_mode = 'verify'` accepted and other unknown values rejected.

**Acceptance**
- [ ] A verify run can be started from the UI in all three languages and ends with one of the two verdicts.
- [ ] The user's idea text appears unchanged in the report.
- [ ] Budget pre-flight works for verify mode; admin estimates are shown.
- [ ] Existing modes behave exactly as before (existing tests pass).
- [ ] At least 5 verify briefs added to the quality test set (WP-01). Their results recorded **only if** the owner approves spend.

---

### WP-02 — Founder profile v2 + starter profiles

**Why:** personal fit is the edge general AI tools lack, and the current profile is thin.

**Design**
1. **Migration:** add columns to `founder_profiles`. All have defaults, so existing rows stay valid.

   | Column | Type and constraint | UI |
   |---|---|---|
   | `interests` | text, ≤500, default `''` | free text + suggestions |
   | `pain_points` | text, ≤500, default `''` | "Problems you've seen up close" |
   | `revenue_target` | text, ≤50, default `''` | enum in zod: `Side income (<$1k/mo)`, `$1–5k/mo`, `$5–20k/mo`, `$20k+/mo` |
   | `strength` | text, ≤30, default `''` | enum: `Technical`, `Sales & marketing`, `Operations`, `Balanced` |
   | `distribution` | text, ≤500, default `''` | "Audiences, networks or communities you can reach" |
   | `languages` | text[], ≤5 items, default `'{}'` | multi-select |
   | `exclusions` | text, ≤300, default `''` | "Things you won't do" |
   | `risk_tolerance` | text, ≤20, default `''` | enum: `Low`, `Medium`, `High` |

   Enumerations live in zod (`profileSchema`); the database only bounds length, as the existing columns do.
2. **Schema:** extend `profileSchema` with the new fields as **optional** with defaults, so `PUT /api/workspace` from older clients still works. Export option lists the way `hoursOptions` / `budgetOptions` are exported.
3. **Onboarding (`components/onboarding.tsx`):**
   - keep the existing steps;
   - add an optional "Make it personal" step (interests, problems, distribution, strength) and one optional "Boundaries" step (revenue target, risk, exclusions, languages);
   - both steps can be skipped;
   - progress bar updated.
4. **Starter profiles:**
   - `lib/starter-profiles.ts` with 4 templates mapped to VentureLens fields (adapted from PocketFounder `lib/starter-profiles.ts`):
     - "Engineer, 5–10 h/week";
     - "Consultant leaving corporate";
     - "Creator with an audience";
     - "Operator in a traditional industry".
   - One click pre-fills the form and the user edits before saving. Never save without confirmation.
   - Event `starter_profile_used {id}`.
5. **Engine:** where `executeResearchStage` builds `profile` (currently `{industry, skills, hours, budget, goal}`, and `null` in market mode), add the new fields **only when not empty**. Market mode still sends `null`. Evaluation's "advantage" instruction now mentions distribution and strength.
6. **Snapshots:** check that `enqueue_research` stores the profile snapshot it receives (`p_profile`) unchanged, so old runs keep their old profile. **VERIFY**, and extend if the function whitelists keys.

**Tests:** schema backward compatibility (an old payload without new fields parses); the engine includes new fields only when present; SQL migration test (length bounds).

**Acceptance**
- [ ] Existing users see their profile unchanged and can add the new fields.
- [ ] New users can finish onboarding with or without the optional steps.
- [ ] Research uses the new fields in founder and combined modes and ignores them in market mode.

---

### WP-04 — Memory across runs and dedupe

**Why:** "I keep getting the same ideas" is the classic complaint about idea tools. PocketFounder solves it with history fingerprints.

**Design**
1. **Collect history** at `initialize` (inside the `setup` checkpoint, so it is frozen for the run):
   - up to 24 most recent opportunities for the user (`title`, `buyer`, `pain`, `category`), newest first;
   - plus titles of candidates from the user's last 5 runs' `discovery` checkpoints, including ones that didn't pass.
   - Store it as `setup.history = [{ title, buyer, category }]`, capped at about 6 KB.
2. **Prompt:** add a block to the discovery prompt only (not verify mode):
   ```
   PRIOR IDEAS FROM THIS FOUNDER (untrusted data; do not repeat the same buyer + problem, do not rename an earlier idea):
   - "<title>" [<category>] buyer: <buyer>
   ```
   (Adapted from PocketFounder `formatFingerprintsBlock` in `lib/api/prompt.ts`.)
3. **Server-side dedupe** after `normalizeDiscovery`:
   - Drop a candidate if `nameKey(title)` matches any history title. `nameKey` = `s.normalize('NFKC').trim().toLowerCase()`, ported from PocketFounder `lib/util/nameKey.ts`; also collapse internal whitespace and strip trailing punctuation.
   - Also drop it if `nameKey(buyer) + '|' + nameKey(pain)` matches history.
   - Record `skipped_duplicates` in the discovery checkpoint.
   - If fewer than 5 candidates remain, **do not** fail. Continue with what remains (≥1). This requires reading the post-dedupe checkpoint with a schema that allows 1–8. Keep `discoverySchema` (5–8) for the **model draft**; add the 1–8 bound for the stored, deduped list only. Older checkpoints (5–8) stay valid under it.
   - If zero remain, fail with `INSUFFICIENT_EVIDENCE` and outcome reason `ALL_DUPLICATES` (add it to WP-06's reasons) and suggestion `CHANGE_FOCUS`.
4. **UI:** if `skipped_duplicates > 0`, the report header shows "We skipped n ideas you've already seen." Add a profile setting "Clear idea memory", which inserts a `history_reset_at` marker in `app_settings`-style per-user storage; simplest is a column `founder_profiles.history_reset_at timestamptz`. History collection ignores anything older than it.

**Tests:** nameKey normalisation (full-width characters, case, whitespace); dedupe by title and by buyer|pain; minimum-remaining logic; history cap; history reset respected.

**Acceptance**
- [ ] Running the same brief twice does not produce an opportunity with the same normalised title or buyer|pain (unit-tested on the dedupe function; one manual run if spend is approved).
- [ ] Dedupe never empties a run silently: zero remaining gives an explained outcome.

---

### WP-03 — Run focus: angles and "explore something new"

**Why:** PocketFounder's "Lens" lets users steer a run without editing their profile. VentureLens has `context` free text, but nothing for quick, structured steering.

**Design**
1. `briefShape` gains `angles: z.array(z.enum(angleOptions)).max(6).default([])` and `explore_new: z.boolean().default(false)`.
2. `angleOptions` in `lib/research-options.ts`. These are **constraints that don't overlap** existing sectors and models:
   `Bootstrapped (no funding needed)`, `Runs async / low-touch`, `No paid ads to start`, `Sells to small businesses`, `Sells to professionals`, `Sells to consumers`, `Local / in-person`, `Remote-only`, `Privacy-first`, `Mobile-first`, `Regulated market is OK`, `Uses my existing audience`, `Recurring revenue from day one`, `Can launch in 30 days`.
   UI shows 8 at a time with a "show all" link and a selection count (amber at ≥4, as in PocketFounder `LensInput`).
3. `context` is relabelled "Focus for this run" with three example placeholders.
4. **Prompt:**
   - `briefFocus(brief)` adds `Constraints for this run: …` for angles.
   - With `explore_new`, it adds: "Identify one assumption shared by the PRIOR IDEAS and invert it in at least half of the candidates; say which assumption was inverted in each candidate's description." This needs WP-04 history; if history is empty, `explore_new` is ignored.
5. **VERIFY** whether `enqueue_research` copies the brief JSON unchanged into `research_runs.configuration`. If it whitelists keys, extend it in a migration.

**Tests:** schema defaults; old briefs parse; prompt contains angles only when set; `explore_new` is ignored without history.

**Acceptance**
- [ ] Angles and "explore something new" are available on `/research/new` in all three languages, saved with the brief, and visible on the run page.

---

### WP-07 — Claim-level citations (methodology v3)

**Why:** "Checkable, not convincing" needs each claim tied to its sources, not just a list of sources at the bottom.

**Design**
1. **Evaluation output** gains, per candidate:
   ```ts
   claims: Array<{ text: string /* ≤400 */, kind: 'observed' | 'inference' | 'assumption',
                   section: 'buyer' | 'pain' | 'demand' | 'competition' | 'economics' | 'risk',
                   source_keys: string[] /* ≤4 */ }>  // 3–12 claims
   ```
   Prompt rules:
   - `observed` claims must cite ≥1 `source_key` of **this candidate's supporting or neutral evidence**;
   - `inference` claims may cite sources;
   - `assumption` claims cite none and must state what would confirm them.
2. **Normaliser** `normalizeClaims(claims, eligibleKeys)`:
   - drops unknown or ineligible `source_keys`;
   - downgrades an `observed` claim with no remaining valid key to `inference`;
   - clips text at a sentence boundary;
   - caps counts.
   - **Contradicting sources may be cited only by `risk` claims.** This keeps counter-evidence visible without it reading as support.
3. **Storage:** `opportunitySchema` gains `claims` (optional) and `methodology_version` (optional, `3` for new rows). Old payloads stay valid. **Do not** change `scores.length(5)`.
4. **UI:**
   - claims rendered by section with numbered citation chips `[1] [2]` that scroll to and highlight the source card;
   - assumption claims carry an "Assumption" label and their confirmation hint;
   - inference claims carry "Inference".
   - Old reports without `claims` render as today.
5. **Cost:** evaluation output grows. Re-estimate, and adjust the `reservationFor` output bound if needed.

**Tests:** normaliser (invalid keys dropped, downgrade, contradicting sources only on risk, caps); schema compatibility for v1/v2 payloads; rendering helper maps keys to citation numbers in a stable order.

**Acceptance**
- [ ] New reports show claims with working citations.
- [ ] No `observed` claim exists without a valid supporting or neutral source.
- [ ] Old reports unchanged.

---

### WP-09 — Opportunity page parity + reading guide

**Why:** VentureLens's own review (B19): real users get a worse opportunity page than the demo.

**Design**
1. Generalise the demo's opportunity detail into one component used by both (`components/opportunity-detail.tsx`), fed by either demo data or live payloads. Tabs:
   - **Overview:** verdict, score with cap and review deduction, buyer, pain, approach, top 3 claims.
   - **Evidence:** all claims by section with citations, source cards (quote, domain, reliability, stance, retrieved date), counter-evidence.
   - **Economics:** price and cost hypotheses from the payload, clearly labelled **assumptions**, plus "what would confirm this". No calculator yet; that's Next.
   - **Validation:** the validation steps, and later the sprint (WP-10).
2. **Reading guide:** one "How to read this report" drawer (score, caps, review deduction, source types, stance, claim kinds, report language and verbatim quotes). Remove repeated per-section disclaimers, keeping only the original-language note for quotes. The demo keeps one persistent "demo data" banner.
3. Mobile: tabs scroll horizontally; the sticky side panel collapses into a summary card.
4. Accessibility: tab pattern with arrow-key navigation; focus moves to the panel when a tab changes.

**Tests:** presentation helpers (tab availability per payload version); i18n coverage.

**Acceptance**
- [ ] The live and demo opportunity pages use the same component and tabs.
- [ ] Each page shows exactly one reading-guide entry point.
- [ ] Older v1/v2 opportunities render without errors.

---

### WP-13 — Flag a claim, rate a report

**Design**
1. Table `public.report_feedback`:
   - `id uuid pk`, `user_id uuid not null`, `run_id uuid not null`, `opportunity_id uuid null`
   - `target text check in ('claim','source','report')`, `target_key text ≤100`
   - `reason text check in ('wrong','outdated','irrelevant','broken_link','other') null`, `comment text ≤1000 default ''`
   - `rating int check between 1 and 5 null`, `created_at timestamptz`
   - Composite foreign keys to `research_runs (id, user_id)` and `opportunities (id, user_id)`; RLS lets users insert and select their own rows; no update or delete in v1.
2. **UI:**
   - a small "Flag" control on each claim and source card (reason + optional comment);
   - a 1–5 rating with an optional comment at the end of each report;
   - confirmation toast;
   - one rating per report per user (upsert through an RPC, or a unique index on `(user_id, run_id, target) where target='report'`).
3. **Admin:** `/admin/quality` gains flag counts by reason, the most-flagged domains, and average rating by mode and model.
4. Events: `claim_flagged`, `report_rated`.

**Acceptance**
- [ ] Users can flag and rate; they cannot read other users' feedback (SQL test).
- [ ] Admins see aggregates.

---

### WP-08 — Live progress + "report ready" email

**Design**
1. **Progress** (`/research/[id]`, `components/research-run.tsx`):
   - plain-language stage descriptions (they partly exist; complete them for all stages and for verify mode);
   - per-candidate progress during retrieval: "Searching 3 of 8 …", with sources appearing as they're saved (title + domain from `research_evidence` for this run);
   - a time estimate from WP-01's median duration per mode, falling back to "about 5 minutes";
   - the page tells the user they can leave and will be emailed;
   - polling keeps the current SWR approach. **VERIFY** the interval and back-off.
2. **Email** (needs decision D1, the provider):
   - `lib/notify.ts` with a provider interface (`send({to, subject, html, text})`). Implement the chosen provider; Resend is suggested.
   - The API key lives in the server environment only. Add it to the README setup section.
   - Sent from the workflow when a run becomes `completed`, or `failed` for reasons other than `WORKFLOW_INTERRUPTED`.
   - Idempotent: column `research_runs.notified_at timestamptz`, set atomically (`update … where notified_at is null returning`).
   - **Content:** run name, outcome ("3 opportunities passed", "Nothing passed — here's why", "The run failed and your run was returned"), and a button to `/research/[id]`. **No profile, brief or report text in the email.**
   - Written in the run's report language, using templates in the three catalogues (or `supabase/templates`-style HTML; **VERIFY** what fits).
   - **Preference:** `founder_profiles.notify_on_complete boolean default true`, with a toggle on `/profile`.
   - In development, a `NOTIFY_DRY_RUN=1` mode logs instead of sending.

**Tests:** notification idempotency (mock); content builder includes no profile or brief text; preference respected; dry-run mode.

**Acceptance**
- [ ] Progress shows per-candidate status and live sources.
- [ ] Exactly one email per finished run when enabled; none when disabled.
- [ ] No email in development without explicit configuration.

---

### WP-10 — Validation sprint workspace v1

**Why:** turns a report into action; this is the main success measure in §1.3.

**Design**
1. **Tables** (RLS, composite foreign keys):
   - `validation_sprints`:
     - `id`, `user_id`, `opportunity_id`
     - `length_days int check in (7,14,30)`, `started_on date`
     - `go_criteria text ≤1000 default ''`
     - `status text check in ('active','completed','abandoned') default 'active'`
     - `decision text check in ('keep','park','kill') null`, `decision_note text ≤1000 default ''`
     - `created_at`, `updated_at`
     - at most one active sprint per opportunity per user (partial unique index).
   - `validation_tasks`:
     - `id`, `user_id`, `sprint_id`
     - `title text 1–300`, `detail text ≤1000 default ''`
     - `due_on date null`, `done_at timestamptz null`, `position int`
     - `origin text check in ('report','user')`, `created_at`, `updated_at`.
2. **Creating a sprint** (RPC `start_validation_sprint(p_opportunity, p_length)`):
   - seeds tasks from the opportunity's `validation[]` steps, spread evenly across the sprint length;
   - marks tasks done if their text appears in the existing `saved_opportunities.completed_tasks`, so existing progress is kept;
   - also saves the opportunity if it isn't already.
   - **Do not delete or rewrite `completed_tasks`**; keep reading it for opportunities without a sprint.
3. **UI:**
   - Validation tab (WP-09): "Start a 7 / 14 / 30-day sprint", task list with due dates, add/edit/reorder tasks, go/no-go criteria text with an example prompt, sprint progress, and a final decision (keep / park / kill) with a note.
   - Dashboard: "Your active sprint" card with the next 3 due tasks.
   - Demo: one fixed example sprint.
4. Events: `sprint_created {length}`, `task_completed`, `sprint_decided {decision}`.
5. Out of scope here (Next backlog): interview log, first-hand evidence feeding the score, offer/smoke-test kit.

**Tests:** SQL (RLS isolation, one active sprint, seeding from `validation[]`, carrying over `completed_tasks`); due-date spreading pure function; UI helpers.

**Acceptance**
- [ ] A user can start a sprint from any saved or unsaved opportunity, manage tasks, record a decision, and see it on the dashboard.
- [ ] Earlier ticked tasks are carried over.

---

### WP-11 — Report export (Markdown + print-to-PDF)

**Design**
1. Pure builder `lib/report-export.ts`:
   - `reportToMarkdown(run, opportunities, outcome, language)` and `opportunityToMarkdown(op, language)`.
   - Includes: verdict, score with cap and deduction, claims with numbered footnotes, sources (title, URL, domain, reliability, stance, retrieved date, verbatim quote), assumptions, validation steps, methodology version, and a generated-on date.
   - Sections the payload lacks are omitted (old reports).
   - Reuses Markdown-download ideas from PocketFounder (`downloadMd` in `components/IdeaCard.tsx`).
2. **Download:** a client button builds the file from data already loaded. No new API is needed if the page has the full payload (**VERIFY** that excerpts are loaded on the opportunity page; `workspaceOpportunity` drops them from list views).
3. **Print to PDF:** routes `/research/[id]/print` and `/opportunities/[id]/print` with print CSS (no navigation, page breaks per opportunity, URLs printed beside link text) and a "Print / Save as PDF" button. **No server-side PDF library.**
4. **The export never includes the founder profile or brief.** Add an optional "Include my brief" checkbox, off by default.
5. Event `report_exported {format}`.

**Tests:** Markdown builder snapshot tests for v1, v2 and v3 payloads in all three languages; profile and brief excluded by default.

**Acceptance**
- [ ] Any completed report and any opportunity can be downloaded as Markdown and printed cleanly to PDF.
- [ ] Old reports export without errors.

---

### WP-12 — Library: archive, undo, filters, delete

**Design**
1. Archive state per opportunity: add `opportunities.archived_at timestamptz null`, changed only through RPC `set_opportunity_archived(p_id uuid, p_archived boolean)`. Users may not otherwise have update rights on `opportunities`; **VERIFY** the current policies.
2. Results and saved lists gain filters: archived (hidden by default, "show archived" toggle), confidence, score range, mode, run. Existing search and sort stay.
3. Archive shows an **Undo** toast (5–8 s), as in PocketFounder `archive-all/undo`.
4. **Delete a research run** (with all its opportunities, evidence, stages and sprints by cascade):
   - only from the run page;
   - typed confirmation;
   - through RPC `delete_research_run(p_run)`, which refuses while the run is `running`.
   - **VERIFY** that cascades cover `research_evidence`, `research_stages`, `research_usage` (usage may need to be kept for cost accounting; if so, detach it with a nullable foreign key or anonymise it rather than delete; decision D6).

**Tests:** SQL tests for both RPCs (ownership, running-run refusal); filter helpers.

**Acceptance**
- [ ] Archive, unarchive, undo and delete work and are isolated per user.
- [ ] Archived items are hidden by default but recoverable.

---

## 6. Next and Later backlog (not in v1; brief specs to keep the design compatible)

| # | Feature | Short spec | Priority |
|---|---|---|---|
| 12 | Competitor table from evidence | Evaluation outputs `competitors[] {name, url (must be a saved source URL), price_seen, observed_weakness, source_key}`; normaliser drops any entry without a matching source. Shown in the Evidence tab | Next |
| 20 | Scenario calculator | `/opportunities/[id]` Economics tab. Pure deterministic module `lib/economics.ts` (12-month customers, MRR, churn, CAC, costs, gross profit, cash). Editable inputs with conservative / base / upside values; AI-suggested starting values each labelled with source or "assumption". Saved per user in `opportunity_scenarios` (RLS). Unit-tested maths; no AI in the calculation | Next |
| 21 | Compare 2–5 opportunities | `/compare?ids=…`. Columns: verdict, score/cap, independent domains, vendor share, buyer reachability claim, recurring-pain claim, key assumption, sprint status | Next |
| 22 | Decision log | Extends WP-10 decisions to opportunities without sprints | Next |
| 24 | Find-your-buyers kit | Generated from evidence: communities, job titles, associations, events, each with a source or "suggestion" label; outreach drafts the user edits. Adapted from PocketFounder `firstTenCustomers` / `gtmPlaybook` but grounded | Next |
| 25 | Interview kit + log | Screener + non-leading script per opportunity; `interviews` table (date, persona, pain 1–5, current workaround, current spend, budget owner, key quote, consent note) | Next |
| 26 | First-hand evidence feeds the score | Interviews, sign-ups, letters of intent and payments become `first_hand_evidence` rows, shown separately from web evidence. A versioned rule raises or lowers confidence; never mixed into the web gate | Next |
| 27 | Offer / smoke-test kit | Landing copy, price hypothesis, pre-order or "book a call" design, metrics to watch | Next |
| 28 | Pilot / pre-sale tracker | Letters of intent, deposits, paid pilots; amounts in minor units | Later |
| 29 | Go/no-go criteria checks | Structured criteria evaluated against #25/#26 data | Next |
| 31 | Build handoff | Product brief + AI-builder prompt from **validated** facts (adapt PocketFounder `buildMasterPrompt` in `lib/prompts.ts`); shown only after sprint progress | Later |
| 32 | Launch plan | 3-month plan from validated facts | Later |
| 34 | Share a report | Read-only link, unlisted by default, profile and brief removed (adapt PocketFounder `lib/share.ts` and the redaction rules in `redactIdeaForPublic`); moderation before public; optional sitemap | Next |
| 35 | Weekly progress email | Uses WP-08 notifier; sprint tasks due + one suggested action; opt-out | Next |
| 36 | Watch a saved opportunity | Monthly re-check of the opportunity's queries; flag new sources or competitors | Later |
| 37 | Advisor comments | Invite by email to read and comment on a report | Later |
| 40 | Self-serve data export and deletion | Export all user data as JSON; delete account with typed confirmation | Next |
| 44 | Quality dashboard v2 | Combine WP-01 metrics with product events into a weekly view | Next |
| 9 | Quick sketches | Optional 60–90-second, clearly unverified idea sketches with a "Verify" button (PocketFounder-style). Only if data shows users want a lighter first step | Later |

---

## 7. Cross-cutting definitions

- **Independent domain:** registrable domain (`tldts`), so subdomains of one publisher count once. Already implemented.
- **Source reliability:** `primary` (first-hand data), `secondary` (independent reporting, professional bodies, forums), `vendor` (a company marketing a solution to this pain), `unknown`. Already implemented; do not change in v1.
- **Claim kinds:** `observed` (stated in a cited source), `inference` (reasoned from sources), `assumption` (not yet supported; must say what would confirm it).
- **Verdict (verify mode):** "Supported by independent evidence (moderate / limited)" or "Not yet supported by independent evidence".
- **Methodology versions:** v1 (original), v2 (review cap 15, stance), **v3 (claims + citations, verify mode)**. Store the version on new payloads and the report.

---

## 8. Owner decisions needed

| ID | Decision | Needed by | Suggested default |
|---|---|---|---|
| D1 | Email provider and sender domain for notifications | WP-08 | Resend, `notifications@smartmango.ai` (or a VentureLens domain) |
| D2 | Does a verify run use one run slot like other runs? | WP-05 | Yes, one slot |
| D3 | Keep releasing the slot for `INSUFFICIENT_EVIDENCE` runs (up to `max_refunds`)? | WP-06 | Keep current behaviour |
| D4 | Spending cap and project for the quality test set | WP-01 | Development project; ≤ $5 per evaluation session |
| D5 | May admins see brief/profile text in the run inspector for support? | WP-01 | No: structural data only, unless the privacy policy is updated |
| D6 | On run deletion, delete or keep (anonymised) usage rows for cost accounting? | WP-12 | Keep usage rows, detached from the user |
| D7 | Should the repository stay public? (It contains admin and pricing details.) | Before WP-08 | Owner's call |
| D8 | Time expectation copy for verify mode | WP-05 | Set after 5 real runs |

---

## 9. Appendices

### 9.1 PocketFounder reference code to port

Repository `ThinkingMango/PocketFounder-Monetised`. To read it from the VentureLens session, attach it with `add_repo`.

| Need | PocketFounder file | Port as |
|---|---|---|
| Name normalisation | `lib/util/nameKey.ts` → `ideaNameKey(name) = (name ?? '').normalize('NFKC').trim().toLowerCase()` | `lib/name-key.ts` (WP-04); also collapse whitespace |
| Prior-ideas prompt block | `lib/api/prompt.ts` → `formatFingerprintsBlock` (cap 24 entries, about 240 chars each) | discovery prompt block (WP-04) |
| Lens and surprise instruction | `lib/api/prompt.ts` → `formatLensBlock`; `lib/lens-chips.ts` (rotating chips, quotas per category, 8 visible) | angles + `explore_new` (WP-03) |
| Starter profiles | `lib/starter-profiles.ts` (engineer / designer / operator) | `lib/starter-profiles.ts` with VentureLens fields (WP-02) |
| Event tracking | `lib/analytics.ts` (`track`, fire-and-forget, props size cap) | `lib/events.ts` (WP-01) |
| Markdown export | `components/IdeaCard.tsx` (download Markdown) | `lib/report-export.ts` (WP-11) |
| Archive + undo | `app/api/ideas/archive-all/*`, `lib/hooks/useIdeaHistory.ts` | WP-12 |
| Sharing + redaction | `lib/share.ts` (`redactIdeaForPublic`, slugs, visibility), `app/i/[slug]`, `app/sitemap.ts`, `lib/moderation.ts` | Next backlog #34 |
| Build handoff prompt | `lib/prompts.ts` → `buildMasterPrompt` | Later backlog #31 |

**Do not port:** PocketFounder's random business-model × industry slot assignment, its unverified unit-economics/funnel fields, its marketing claims, or anything billing-related (out of scope).

### 9.2 Pull request checklist (copy into each PR description)

```
WP: WP-xx — <name>
Spec sections: §5 WP-xx (+ any deviations explained below)

Changes
- …

Database
- Migration: <file> (new / none). Applied to: <dev project / not applied>. RLS + grants checked: yes/no
- SQL tests: <file(s)>

Verification (ran = executed here; reviewed = code-read only)
- pnpm typecheck: ran ✅/❌
- pnpm test: ran ✅/❌ (<n> tests)
- pnpm build: ran ✅/❌
- pnpm test:sql: ran / not run (reason)
- Live research run: not run / ran with owner approval (<run id>, $<cost>)

i18n: new strings added to en / zh-Hans / zh-Hant: yes/no
Demo: updated / not applicable
Old reports still render: checked how
Deviations from spec: …
Owner decisions needed: …
Status for docs/IMPLEMENTATION_STATUS.md: Implemented and tested / Implemented but not verified / Blocked / Not started
```

### 9.3 Status vocabulary

- **Implemented and tested:** code merged and the listed checks were run and passed.
- **Implemented but not verified:** code merged; some behaviour (live provider, email, production database) not exercised.
- **Blocked:** waiting on an owner decision, credential or environment. State which.
- **Not started.**

### 9.4 Definition of done for v1

All of WP-00 to WP-13 are "Implemented and tested", or "Implemented but not verified" with only live-provider or email items outstanding, **and**:
- [ ] a new user can sign up, complete profile v2, run **either** discovery **or** verify, watch progress, receive an email, read a report with cited claims (or an explained null result), start a validation sprint, export the report, and flag a claim, in all three languages;
- [ ] old reports created before v1 still open and export;
- [ ] the quality test set has been run once on a development project within the approved cap, and its summary is committed under `docs/eval/`.
