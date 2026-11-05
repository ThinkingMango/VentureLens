# VentureLens AI — Holistic Review (November 2026)

> **Scope:** codebase, architecture, delivery plan (`plan.md`), business model, and UI/UX, reviewed at `main` `6719102` (merge of PR #11).
> **Method:** full source read of `app/`, `components/`, `lib/`, `workflows/`, `supabase/`, `tests/`, `i18n/`, `messages/`; local execution of `pnpm typecheck`, `pnpm test` (81/81 pass), `pnpm build` (pass); Playwright screenshots of every public and demo route at desktop and mobile widths.
> **Not executed:** Supabase integration test, research E2E test, any live provider call. Findings about runtime behaviour of the research engine are therefore code-reviewed, not observed.
>
> Severity scale: **P0** blocks real users or risks money/data · **P1** materially hurts conversion, trust, or maintainability · **P2** worth fixing in the next quarter · **P3** polish.

---

## 1. Executive summary

VentureLens is further along than most "AI idea" products: the research engine is genuinely evidence-gated (two independent domains, grounded quotes, capped scores, adversarial deduction), authentication is passwordless and scanner-safe, RLS is enforced, and the demo is cleanly isolated from real data. The codebase is small (≈14k lines), typed, and tested at the core.

The product nevertheless has one **fatal first-time-user problem** and three **structural risks**:

1. **Every new account hits a wall.** Live research is gated by a manually inserted `research_dev_access` row (max 3 runs). A new user who signs up, completes onboarding, fills in a brief and presses "Start" receives `DEV_ACCESS_REQUIRED`. Before this review nothing in the UI warned them. *(Fixed in this PR: access is exposed in workspace data and the UI pre-flights it.)*
2. **Reports are produced in Chinese regardless of UI language.** The system prompt in `lib/research-engine.ts` instructs the model that "all human-readable conclusions use Chinese", and the summary, limitations and confidence labels in `finalizing` are hard-coded Chinese strings. English and Traditional-Chinese users receive a Simplified-Chinese report inside an English interface.
3. **Fresh database setup is broken.** Two migrations (`20261104000000_venturelens_workspace.sql` and `202611040001_venturelens_workspace.sql`) create the same tables without `IF NOT EXISTS`; whichever runs second fails.
4. **The business model is not yet sellable.** Pricing is illustrative, there is no entitlement/ledger model, failed runs would consume quota, and a monthly subscription is proposed for a product whose core job ("find my idea") is naturally one-off.

Recommended order of work: **unblock activation** (this PR + a free-credit grant on signup) → **fix report language and run-failure economics** (M1) → **reconcile migrations and document** (M0 hygiene) → **entitlements + Stripe test mode** (M3). Details below.

---

## 2. What is good (keep it)

| Area | Why it matters |
| --- | --- |
| **Evidence gating in `lib/research-core.ts`** (`groundedClassifications`, `eligibleEvidence`, `weightedScore` caps 70/85, review-only deductions) | This is the actual moat. Competitors generate plausible text; VentureLens drops candidates without independent, non-vendor evidence. It is deterministic and unit-tested. |
| **Durable workflow with checkpoints** (`workflows/research.ts`, `research_stages`) | Stages are idempotent and resumable; a retry re-uses cached stage output. |
| **Budget reservation model** (`reserve_research_usage` RPC, `research_usage` ledger) | Reserve → consume/unknown is the right shape for metering AI spend; "unknown" status after transport failure is honest. |
| **SSRF-hardened source fetching** (`lib/research-source.ts`) | DNS pinning, private-range rejection, redirect re-validation, size and content-type limits. Better than most. |
| **Passwordless auth with scanner-safe confirm page** | The "Continue" form on `/auth/confirm` neutralises link scanners; same-origin referrer policy is correct. |
| **RLS with `force row level security` and composite FKs `(id, user_id)`** | Cross-tenant leakage via FK joins is structurally prevented. |
| **Demo isolation** (`DemoProvider` vs `WorkspaceProvider`, `/demo/*` prefix) | Synthetic data can never be saved into a real account; the UI labels it everywhere. |
| **Accessibility baseline** | Focus management in dialogs/tabs, `aria-live` on progress, skip link, 44px targets, reduced-motion support. |
| **Honest copy** | No fake testimonials, no invented stats, explicit "not verified" labels. This is rare and should be preserved as a brand value, but see §6 on disclaimer fatigue. |

---

## 3. Bugs and defects

### P0

| # | Finding | Where | Consequence | Fix |
| --- | --- | --- | --- | --- |
| B1 | **Duplicate initial migrations.** Both files run `create table public.founder_profiles …` etc. with no idempotency guard. | `supabase/migrations/20261104000000_*.sql`, `202611040001_*.sql` | `supabase db reset` / any fresh environment fails; CI cannot provision a disposable DB. | Inspect the live project's `supabase_migrations.schema_migrations`. If only one applied, delete the other **and** record the decision in `docs/DATABASE_MIGRATIONS.md`. If both were "applied" (second failed silently), repair the history with `supabase migration repair`. Never edit the applied file. |
| B2 | **No self-serve path to a real research run.** `enqueue_research` raises `DEV_ACCESS_REQUIRED` unless an operator inserts into `research_dev_access`. | `supabase/migrations/20261104020000_research_engine.sql`, `app/api/research/route.ts` | 100 % of organic signups fail at the core action. | Short term (done here): expose `access` in `WorkspaceData`, pre-flight in UI. Medium term: grant 1 free run on email confirmation via trigger with rate limiting; long term: entitlement ledger (M3). |
| B3 | **Report language forced to Chinese.** `policy` string: `所有人类可读结论使用中文`; `summary`, `limitations`, `confidence` built from Chinese literals in `finalizing`. | `lib/research-engine.ts` L150, L382, L388 | English/zh-Hant users get a zh-Hans report. The UI even says "Report content stays in its original language", which reads as a bug to a first-time user. | Persist `report_language` on the run (default = UI locale at creation), inject into `policy`, generate summary/limitations through the model or from localized templates, map confidence to an enum (`limited`/`moderate`) and translate in the UI. |
| B4 | **Failed runs consume quota permanently.** `enqueue_research` increments `runs_used`; nothing decrements on `failed`. With `maxRetries = 0` on every step, one malformed JSON (`INVALID_OUTPUT`) or one provider blip that is not classified as transient burns a run. | migration `20261104021000_research_quota_ledger.sql`, `workflows/research.ts` | Users with 3 runs can lose all three to provider noise; the planned credit model inherits the same flaw. | Release the run (or credit) when `status='failed'` and `error_code` is not user-caused; add one automatic retry for `INVALID_OUTPUT` with a stricter re-prompt before failing. |

### P1

| # | Finding | Where | Consequence | Fix |
| --- | --- | --- | --- | --- |
| B5 | **Provider settings stored on a user's `app_metadata` and found by paginating `auth.admin.listUsers`** on every run initialisation and every admin read. | `lib/provider-settings.ts` `providerSettingsOwner()` | O(users) scan per research run; becomes a latency and rate-limit problem at a few thousand users. Settings are also invisible to SQL/backup tooling. | Create `public.app_settings (key text pk, value jsonb, updated_by uuid, updated_at)` with service-role-only writes. |
| B6 | **Admin identity hard-coded to an email constant and shipped to the browser.** | `lib/admin-access.ts`, imported by `components/admin-providers.tsx` | Owner email exposed in a public repo and client bundle; brittle if the mailbox changes; `app_metadata.role` path exists but is secondary. | Use only `app_metadata.role === 'admin'` (server-managed); remove the constant from client code. |
| B7 | **Budget reservation for Qwen Flash retrieval is ~\$0.17 of a \$0.25 run budget.** `searchInputAllowance: 1_000_000` tokens × \$0.15/M + 32 searches × \$0.00057. | `lib/research-models.ts`, `lib/research-engine.ts` `reserve()` | Any retrieval call that ends in `unknown` status (transport failure after send) leaves \$0.17 reserved and the next reservation fails with `BUDGET_EXCEEDED`. The plan's own P0 flags this. | Reserve on a realistic allowance (p95 observed input, e.g. 60k tokens) and keep the 1M figure only as a hard abort limit; reconcile `unknown` rows asynchronously from provider usage APIs. |
| B8 | **`budget_usd` is constrained to `<= 0.25` in the schema.** | migration `20261104020000` | Raising the budget for a paid tier requires a migration; the cap is a business parameter, not an invariant. | Move the cap to `app_settings`; keep a sane upper bound (e.g. 5.00) in the check. |
| B9 | **Idempotency key is reused after edits.** `requestKey.current ??= crypto.randomUUID()` persists for the component's lifetime. | `components/research-config.tsx` | If the first POST reached the DB but the response was lost, a user who edits the brief and resubmits silently gets the *old* run back. | Regenerate the key whenever the draft changes after a submission attempt. |
| B10 | **Demo scores exceed the maximum a real report can produce.** Demo shows 87/100; live `weightedScore` caps at 85. | `lib/demo-data.ts` vs `lib/research-core.ts` | First real report looks "worse" than the demo; also, demo dimension names did not match the live five dimensions. | Dimension names aligned in this PR; consider capping demo scores at 85 or labelling the cap in the demo. |
| B11 | **`confidence` is a free-text Chinese string in live reports** (`中等：仍需一手验证`), while the `Confidence` badge only localises `Higher/Medium/Lower`. | `lib/research-engine.ts` L382, `components/shared.tsx` | Badge text is translated only because an en.json entry happens to exist for the Chinese literal; brittle. | Store an enum and localise in UI. |
| B12 | **Two user-facing disclaimers contradict the product promise.** "Report content stays in its original language" and "Saved research stays in its original language. Changing the interface never regenerates or translates reports" appear on every report. | `components/research-report.tsx`, `opportunity-evidence.tsx` | Reads as "we will not fix the language bug". | Remove once B3 is fixed; keep only "source excerpts are kept in their original language". |

### P2

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| B13 | `researchDetail()` (a read helper used by GET) mutates run status to `failed` when it detects a dead workflow. Side effects in a read path make behaviour depend on who polls. | `lib/research-service.ts` | Move reconciliation into a scheduled job or the workflow's own failure handler; keep GET pure. |
| B14 | `proxy.ts` redirects authenticated users from `/login?next=…` to `/dashboard`, discarding `next`. | `proxy.ts` | Honour `safeReturnPath(next)`. |
| B15 | `profileSchema.industry` allows `Other` but `projectSchema.sector` does not; a founder with "Other" cannot target their own industry. | `lib/workspace-schema.ts` | Align enums; plan M2 extends them anyway. |
| B16 | Stale translation keys (password-era strings: "Forgot your password?", "Choose a stronger password…", "Morgan"). | `messages/*.json` | Add a prune step to the i18n script. |
| B17 | No Content-Security-Policy header; `X-Frame-Options` only on some routes. | `next.config.ts` | Add CSP (nonce-based) and apply frame-ancestors globally. |
| B18 | `research-engine.ts`, `research-service.ts`, migrations are written one statement per very long line (700+ chars). | `lib/*.ts`, `supabase/migrations/*.sql` | Run Prettier/`pg_format`; split the engine into `discovery.ts`, `retrieval.ts`, `classification.ts`, `scoring.ts`, `finalize.ts`. Readability is a security property here. |
| B19 | `LiveOpportunityDetail` was a flat `<dl>` while the demo detail has tabs, score bars, and economics — real users got a worse page than the demo. | `components/live-workspace.tsx` | Partially addressed in this PR (score breakdown, sources count, progress). Full parity (tabs, economics) remains. |
| B20 | `requireExactIds` for discovery expects `c1..cN` in order while the schema allows 5–8 candidates and the prompt asks for 8; a model returning 6 valid candidates keyed `c1..c6` passes, but one returning `c1,c2,c4…` fails the whole run. | `lib/research-engine.ts` | Re-key candidates server-side instead of failing. |

---

## 4. Architecture assessment

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · Supabase (Auth, Postgres, RLS, RPC) · Vercel Workflow for the research job · Vercel AI SDK with Qwen (DashScope Beijing) primary and Gemini fallback · next-intl with hashed message keys.

### 4.1 What is right

- **Server-controlled money paths.** All spend goes through `security definer` RPCs; the browser never chooses model, budget or price.
- **Composite FK isolation** and `force row level security` are the correct Supabase pattern.
- **Workflow steps with `maxRetries = 0`** is a defensible choice to avoid double billing; the trade-off (fragility) is documented in B4.
- **Zod everywhere** — structured outputs, API inputs, stored JSON payloads — gives a clean upgrade path for the 8-criterion scorecard (version the schema, keep `scores.length(5)` for v1 rows).

### 4.2 Structural concerns

| Concern | Detail | Recommendation |
| --- | --- | --- |
| **i18n keying by FNV hash of source string** | `copy("Some English text")` → `m1abc…`. Catalogues are machine artefacts; any copy edit silently falls back to the source language; Chinese source strings in live-mode components are "translated" into English via the English catalogue (inverted direction). The i18n test catches *literal* calls only — strings passed through variables (arrays of titles) are unchecked. | Keep the hash scheme (it works) but (a) use the merge script now committed at `scripts/i18n-merge.mjs` and add an extraction step that lists untranslated literals, (b) make the test walk all string literals in `components/**` not just `copy()` literals, (c) forbid non-English source strings by lint rule. |
| **Settings in auth metadata** | See B5. | `app_settings` table. |
| **Access gating in auth tables vs. domain tables** | `research_dev_access` is a dev artefact that will become production entitlements by accident. | Introduce `entitlements` (`user_id, kind ('beta'|'purchase'|'subscription'|'promo'), credits_granted, credits_used, expires_at, source_ref`) now, and make `enqueue_research` consume from it. `research_dev_access` becomes one `kind`. |
| **No observability** | No structured logging, no error tracker, no metrics for completion rate / cost per successful report — which the plan itself lists as the launch metrics. | Add Sentry (or Vercel's equivalent) + a `research_run_events` table or log drain; dashboard the four numbers in §8 of `plan.md`. |
| **No CI** | `.github/` is absent; the plan's M7 asks for it. | Add a workflow running `pnpm typecheck && pnpm test && pnpm build` on PRs, plus `supabase db reset` against a disposable DB once B1 is fixed. |
| **Pricing data as code with date switches** | `researchModelPricing()` hard-codes future price changes by date. | Move to `app_settings` with `checked_at`; fail closed (use the higher price) if stale > 30 days. |
| **Retrieval latency** | Sequential page fetches (pairs, 15 s timeout) × up to 10 sources × 8 candidates → worst case ~10 min; no per-candidate progress beyond a count. | Fetch 4 pages concurrently with a 8 s timeout; emit per-candidate stage checkpoints with source counts (the UI already reads `steps`). |
| **Single `opportunities.payload` JSON blob** | Fine for v1; will hurt once comparison/financial-model features need columns. | Promote `score`, `confidence`, `candidate_id`, `evidence_count` to columns when M4 starts. |

### 4.3 Security notes

- Origin check on mutating API routes is a reasonable CSRF defence given SameSite=Lax cookies; keep it.
- `safeSourceUrl` + `sourceUrl` double validation is good; consider also blocking `.gov.cn`/intranet-style allowlists only if the product goes enterprise.
- Prompt-injection stance ("web pages are untrusted data") is stated in the policy but not tested; add a red-team fixture to `tests/research.test.mjs` that includes an excerpt with instructions and asserts it does not alter classification.
- Public repo: `ADMIN_EMAIL`, workspace naming, and pricing tables are all public. Nothing secret is committed, but the owner should decide whether the repo should remain public before Stripe work lands.

---

## 5. Plan review (`plan.md`)

The plan is unusually honest ("not a record of successful execution") and the milestone order (M0 stabilise → M1 quality/language → M2 profile → M3 Stripe) is right. Gaps:

1. **Activation is missing as a milestone.** Nothing between M0 and M3 lets a stranger run research. Add **M0.5 — Self-serve beta**: one free run on confirmed email, abuse limits, access status in UI (this PR), waitlist capture for more.
2. **M1 should include "failed run economics"** (B4) explicitly; otherwise M3 will price-in failures the engine causes.
3. **The 8-criterion scorecard** (M1) needs a *data* plan: `scorecard_version` on runs, `dimensions jsonb` instead of `scores number[5]`, and a presentation layer that reads labels from the version. The current `opportunitySchema.scores.length(5)` is a hard constraint on old rows — keep it for v1.
4. **M2 geographies** (HK, Mainland China) imply retrieval-provider constraints (Google Search grounding availability, Chinese-language sources, Baidu). Call this out as a research spike, not a form-field change.
5. **M6 marketing** is scheduled last, but the landing page is the top of the funnel and was generic. This PR pulls part of M6 forward because it costs nothing in backend risk.
6. **Documentation deliverables** (§7 of the plan) do not exist yet; `README.md` was one line. This PR adds `README.md` and this review; `docs/IMPLEMENTATION_STATUS.md`, `DATABASE_MIGRATIONS.md`, `TEST_RESULTS.md` should be created when M0 runs.
7. **Metrics** (§8) have no instrumentation plan. Tie each metric to a table/event before M1 ends.

---

## 6. UI/UX review

### 6.1 Before this PR

- **Visual identity:** clean but generic shadcn defaults (one blue, flat cards, no depth). Competent, not memorable. Screens looked like an internal admin tool rather than a product someone pays \$39/month for.
- **Landing page:** headline ("Less guesswork. More business opportunity.") did not say what the product *does*; no "what's inside a report", no FAQ, no explanation of the evidence rules — the single most differentiating feature was invisible. Primary CTA led to signup, which leads to the dev-access wall.
- **Disclaimer fatigue:** the demo dashboard alone carried five separate "synthetic/illustrative/not verified" notices. Honesty is a strength; repetition reads as anxiety and lowers perceived value.
- **Dead ends:** every pricing button, "About billing management", "About scheduling interviews" opened a toast saying the feature does not exist.
- **Live workspace first run:** four zero-value stat tiles and one empty-state card. No guidance on what to do first; no indication that research would fail.
- **Language mixing:** Chinese research output and Chinese source strings inside English screens (`等待处理` status labels are translated only through the catalogue trick).
- **Live vs demo parity:** the demo opportunity page had tabs, score bars, economics, and validation; the real one was a definition list.
- **Research run page:** stage names were opaque ("Classification", "Finalizing"), cost details (tokens, USD to four decimals) were developer-facing, no time expectation.

### 6.2 What this PR changes

| Area | Change |
| --- | --- |
| Design system (`app/globals.css`, `button.tsx`, `card.tsx`) | Deeper navy foreground, indigo primary with a `--primary-deep` hover, warm and success accent tokens, card/float shadows, larger radii, gradient hero and dark "band" surfaces, `.lift` hover, `.eyebrow`, `.step-number`, smooth progress fills. All existing components inherit through tokens. |
| Landing (`components/landing.tsx`) | New headline ("Find a business worth building. Then prove it."), demo-first CTA, richer product mockup with score breakdown and source chips, **"Inside every research report"** (6 cards), numbered **How it works**, **"Rules the research engine cannot break"** dark band (the four enforced evidence rules), **Who it's for**, **FAQ** (5), gradient final CTA. No fake social proof. |
| Public shell | Sticky translucent header, anchor nav (What you get / How it works / Live demo / Pricing / FAQ), three-column footer with beta disclosure. |
| Pricing | Framed as *planned* pricing with per-run cost shown, three policy cards (failed runs, free demo, prices may change), extra FAQ on beta access, dual CTA. |
| Auth | Dark gradient side panel with the three-step "what happens next" and a "Free during beta" note. |
| Onboarding | Eyebrow time estimate, progress bar per step, hero background. |
| Live dashboard | **Getting-started checklist** (profile ✓ → brief → run → shortlist) with progress and context-aware actions; **research access card** (enabled / exhausted / not enabled) replacing the silent failure; compact stats; "not sure what to expect" demo pointer for fresh accounts. |
| New research | Access pre-flight banner; when access is absent the form **saves the brief** instead of failing; English source copy; "What happens when you start" pipeline aside; time expectation on the submit row. |
| Research run | Plain-language description of the current stage plus a 5–10 minute expectation. |
| Live opportunity detail | Score breakdown with the five live dimensions, confidence badge, linked-source count, review deduction, validation progress bar, sticky aside. |
| App shell | Access card in the sidebar for real accounts. |
| Data | `WorkspaceData.access` (`enabled`, `remaining`, `maxRuns`, `expiresAt`) read from `research_dev_access` under RLS. |
| i18n | 149 new strings in English, Simplified and Traditional Chinese; demo score dimensions aligned with the live engine. |

### 6.3 Still recommended (not done here)

1. **Fix B3 (report language)** — the largest remaining UX defect for English users.
2. **Live opportunity tabs** (Overview / Evidence / Economics / Validation) to reach demo parity; the demo component can be generalised.
3. **Consolidate disclaimers** into one persistent demo banner and one per-report "How to read this" drawer.
4. **Replace dead-end toasts** with a waitlist capture (email + intent) stored in Supabase; it doubles as a demand signal for pricing.
5. **Dark mode** — tokens are ready; add `prefers-color-scheme` overrides and audit the dark band and charts.
6. **Research run page**: move tokens/USD under "Technical details"; show per-candidate retrieval progress.
7. **Empty states with illustrations** (lightweight SVG) on Saved/Results.
8. **Mobile nav**: the mobile menu is a plain list; add the CTA button and language switcher inside it.
9. **Report export** (PDF/Markdown) for real reports — the demo has a text export; real users have none.

---

## 7. Business model review

### 7.1 Unit economics (from code, not observed)

| Item | Value | Source |
| --- | --- | --- |
| Hard per-run AI budget | \$0.25 | `research_runs.budget_usd` check |
| Reservation per retrieval call (Qwen Flash) | ≈ \$0.17 | `reserve()` with 1M-token allowance |
| Likely *actual* AI cost per completed run | \$0.05–0.20 (unmeasured) | token prices in `research-models.ts`; discovery/eval/review prompts are small |
| Hosting/Workflow per run | unknown, excluded from ledger | `research_usage` note |
| Proposed price per credit | \$5.80 / \$3.90 / \$2.63 | `components/pricing.tsx` |

Gross margin on AI cost alone is >90 %. The real cost drivers will be **failed runs** (currently charged to the user via quota), **support**, and **retrieval provider minimums** (Google Search grounding is paid-tier only).

### 7.2 Assessment

| Aspect | Verdict | Reasoning |
| --- | --- | --- |
| **Positioning** | Strong, under-communicated | "Evidence-gated opportunity research" is a real differentiator against idea generators and ChatGPT. The old landing page did not say it; the new one leads with it. |
| **Target customer** | Plausible but broad | Aspiring founders have low willingness to pay and high churn. Independent professionals productising expertise are the better-paying wedge; consider leading with them. |
| **Packaging** | One-time pack ✔, subscription ✖ (for now) | "Find my idea" is episodic. A \$39/month plan for a product most users need for 2–4 weeks will churn in month two and generate refund requests. Lead with the \$29 Sprint; introduce a subscription only when M4/M5 (financial model, validation workspace) give a reason to stay. |
| **Credit semantics** | Undefined | Must specify: failed runs free (B4), retries free, credit expiry, rollover, refund window. The pricing page now states the *intended* policy; the backend does not enforce it yet. |
| **Activation** | Broken | No free run → no activation → no conversion data. Grant one run on confirmed email; cost ≈ \$0.25 per signup, cheap against any paid acquisition. |
| **Trust** | Asset | The honesty posture is unusual and valuable; it should be a stated brand principle ("checkable, not convincing"). |
| **Market risk** | Medium | Dependence on Chinese-region Qwen endpoint and Gemini grounding; English-market users may be sensitive to data residency. Make provider region visible in the privacy policy. |
| **Localisation strategy** | Half-built | Three UI locales but English-only geographies and Chinese-only reports. Pick: either ship zh markets properly (HK/CN geographies, zh sources) or ship English end-to-end first. Doing both halfway satisfies neither. |

### 7.3 Suggested commercial sequence

1. **Beta (now):** free account, 1 free run after email confirmation, waitlist for more; collect the four launch metrics.
2. **Paid packs (M3):** Sprint \$29/5 and a \$9 single-run "Try one" SKU to lower the first-purchase barrier; Stripe Checkout `payment` mode only.
3. **Subscription (after M4/M5):** only once there is a recurring job (saved models, validation tracking, re-runs on new evidence).
4. **Pricing test:** run the per-run price between \$4 and \$8 in packs before fixing subscription tiers.

---

## 8. Prioritised action list

| Priority | Action | Effort | Owner |
| --- | --- | --- | --- |
| P0 | Merge this PR (activation UX, access pre-flight, landing) | done | — |
| P0 | ~~Reconcile duplicate migrations; document in `docs/DATABASE_MIGRATIONS.md` (B1)~~ **done 2026-11-05** | — | — |
| P0 | ~~Free run on email confirmation + abuse limits (B2)~~ **done 2026-11-05** (migration `20261105155412`) | — | — |
| P0 | ~~Report language per run; enum confidence; remove "stays in original language" copy (B3, B11, B12)~~ **done 2026-11-05** (not yet verified with a live run) | — | — |
| P0 | ~~Release quota on failure (B4)~~ **done 2026-11-05**; manual retry now also covers `INVALID_OUTPUT` and `RETRIEVAL_UNAVAILABLE`. An automatic retry is still open. | — | — |
| P1 | ~~`app_settings` table; move provider settings and budget cap (B5, B8)~~ **done 2026-11-05** (migration `app_settings_and_role_admin`); pricing still in code | — | — |
| P1 | ~~Admin by `app_metadata.role` only; drop email constant from client (B6)~~ **done 2026-11-05** | — | — |
| P1 | Realistic retrieval reservation + async usage reconciliation (B7) | 1 d | research |
| P1 | CI workflow (typecheck, test, build, db reset) | 0.5 d | infra |
| P1 | Live opportunity tabs to demo parity; disclaimer consolidation | 1.5 d | frontend |
| P1 | Prettier + split `research-engine.ts` (B18) | 1 d | research |
| P2 | Entitlements ledger replacing `research_dev_access` (pre-Stripe) | 2 d | backend |
| P2 | Observability + metrics dashboard | 2 d | infra |
| P2 | i18n: commit merge script, lint non-English sources, prune stale keys (B16) | 1 d | frontend |
| P2 | CSP header, idempotency-key regeneration, `next` on login redirect (B17, B9, B14) | 1 d | frontend |
| P3 | Dark mode, illustrations, report export | 3 d | frontend |

---

## 9. Verification performed for this review and PR

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK |
| `pnpm typecheck` | OK (before and after changes) |
| `pnpm test` | 81/81 pass (before and after changes) |
| `pnpm build` | OK (before and after changes) |
| Playwright screenshots, `/`, `/pricing`, `/login`, `/demo/*` at 1366 px and 390 px | Captured before/after; reviewed visually |
| `pnpm test:integration`, `pnpm test:research:e2e` | **Not run** (require Supabase and provider credentials) |
| Authenticated live workspace screens | **Not rendered** (no Supabase in this environment); logic reviewed and type-checked only |
