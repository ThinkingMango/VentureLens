# VentureLens — Enhancement Plan (post-v1): from report to first buyers

> **Purpose:** the next build plan after the v1 specification (`docs/PRODUCT_SPEC_V1.md`, WP-00 to WP-13). It triages the spec's §6 "Next and Later" backlog against what VentureLens's own research says founders struggle with, and turns the surviving items into ordered work packages.
> **Audience:** a coding agent working inside the `ThinkingMango/VentureLens` repository, and the owner who reviews its pull requests.
> **Prepared:** 2026-11-11, from a source read of `main` at `6b7b450`.
> **Status of this document:** a plan, not a record of execution. Statements about the current code were true at `6b7b450`. Anything marked **VERIFY** must be checked in the repository before you rely on it.
> **Scope:** product features. Pricing and payments stay out of scope for code (spec §1.4 and `plan.md` M3); §9 lists the commercial work the owner runs alongside, without code.

---

## 0. How to use this document

1. **Everything in `docs/PRODUCT_SPEC_V1.md` §0 (how to work) and §3 (engineering guardrails) still applies** to every work package here: new migrations only, RLS on every user table, metered provider calls, server-side normalisers, `copy()` for all UI text in three languages, demo parity with fixed data, honest status reporting.
2. Work packages continue the spec's numbering from **WP-14**. One branch and one pull request per WP unless it says otherwise.
3. **Respect the gates in §5.** A gate is a check of real usage data. If a gate fails, stop and bring the result to the owner rather than building the next phase.
4. Update `docs/IMPLEMENTATION_STATUS.md` at the end of each WP with the spec's status words (§9.3 there).
5. Stop and ask the owner at every item in §8 (Owner decisions).

---

## 1. Why this plan exists

### 1.1 The finding

On 2026-11-11 VentureLens researched an "AI ideation SaaS for aspiring founders", a product close to VentureLens itself. It scored **37/100, mixed evidence, limited confidence**. Its main points:

- **Idea generation is commoditised.** Free general chatbots brainstorm ideas and plans at no cost.
- **The need is one-off.** Founders stop needing ideas once they pick one, so recurring subscriptions churn.
- **Distribution is a bigger hurdle than ideas.** This was an *inference* from one secondary source, and the run hit its evidence cap.

### 1.2 What the wider evidence says

| Claim | Evidence | Implication for VentureLens |
|---|---|---|
| The top reason startups fail is building something nobody needs | CB Insights post-mortems: "no market need" cited in **42%** of failures; "poor marketing" in 14% [S1] | Picking a real problem (VentureLens's strength) matters more than the report's inference suggests. Reaching buyers is the **second** gap, not a replacement for the first. |
| AI subscriptions churn fast | RevenueCat 2026: AI apps churn ~30% faster; **6.1%** of AI monthly subscribers retained after 12 months vs 9.5% non-AI [S2] | Value must sit in the phase the founder is in, not in a monthly run count. |
| Long self-paced material is rarely finished | Harvard/MIT MOOCs: **3.13%** of participants completed [S3] | A long generic "playbook" will not move the success measure. |
| Specific when/where/how plans raise follow-through | Implementation intentions meta-analysis, 94 tests: **d = 0.65** on goal attainment [S4] | Steps should be dated, placed and concrete ("if X, then I will Y"). |
| Interest is not validation; commitment is | *The Mom Test*: count commitments of time, reputation or money, not compliments [S5] | First-hand evidence must be logged by kind, with payments ranked above opinions. |
| Competitors sell one-time reports | DimeADozen $9–$129 one-time; IdeaProof $19 one-time; WorthBuild $5; ValidatorAI core tool free; IdeaBrowser $1,499/yr (content + community) [S6] | A longer report is not a differentiator. Helping the founder act on the report is. |

### 1.3 The thesis

> VentureLens wins by turning each report's assumptions into **small, dated experiments** that are tied to the report's own sources, come with the artifact needed to run them, and record their results as **first-hand evidence**. A free chatbot can't copy this, because it depends on saved evidence and the founder's logged outcomes. Those outcomes become VentureLens's proprietary data.

This plan builds on what the spec already says: principle 5 ("real-world evidence beats web evidence") and the main success measure in §1.3 (the share of active users who take a real-world validation action within 30 days of their first report).

### 1.4 What this plan is not

- **Not a generic playbook or course.** No long static guides (see [S3]).
- **Not an idea generator.** Quick sketches (#9) are dropped (§7).
- **Not an outreach robot.** VentureLens drafts messages; the founder edits and sends them. No automated sending, scraping of private profiles, or bulk messaging.
- **Not a website builder** (spec non-goal). Smoke-test pages are exported to tools the founder already uses.

---

## 2. Backlog triage (spec §6, 19 items)

None of the 19 items had been started at `6b7b450` (checked in `lib/`, `app/`, `components/`, `supabase/migrations/`).

**Result: 13 kept (6 core, 7 reshaped or merged) → 11 work packages; 4 deferred; 2 dropped.**

| # | Item | Verdict | Where it goes |
|---|---|---|---|
| 24 | Find-your-buyers kit | **Core** | WP-18 |
| 25 | Interview kit + log | **Core** | WP-19 |
| 26 | First-hand evidence feeds the score | **Core** | WP-20 |
| 27 | Offer / smoke-test kit | **Core** | WP-24 |
| 29 | Go/no-go criteria checks | **Core** | WP-21 |
| 35 | Weekly progress email | **Core** | WP-17 |
| 12 | Competitor table from evidence | Keep | WP-23 |
| 20 | Scenario calculator | **Reshaped** to a one-screen "path to target" check | WP-24 |
| 22 | Decision log | **Merged** into #29 | WP-21 |
| 28 | Pilot / pre-sale tracker | **Merged** into #26 (evidence kinds) | WP-20 |
| 34 | Share a report | Keep, promoted (growth channel) | WP-26 |
| 40 | Self-serve data export and deletion | Keep, **required before billing** | WP-25 |
| 44 | Quality dashboard v2 | Keep, **needed first** to measure everything else | WP-15 |
| 21 | Compare 2–5 opportunities | Deferred | §7 |
| 31 | Build handoff | Deferred | §7 |
| 36 | Watch a saved opportunity | Deferred | §7 |
| 37 | Advisor comments | Deferred | §7 |
| 9 | Quick sketches | **Dropped** | §7 |
| 32 | Launch plan | **Dropped**; distribution parts move to WP-18 | §7 |

**Added (not in the backlog):**

| Gap | Where it goes |
|---|---|
| Verify the 13 shipped WPs with real usage before adding more | WP-14 |
| Opportunity-specific next steps, replacing the four fixed `firstSteps` | WP-16 |
| "Can you reach these buyers?" as a scored dimension with a cap | WP-22 (`plan.md` M1 proposed reachability at 20%) |
| Pricing by phase, and institution seats | §9, owner track, no code |

---

## 3. Principles added by this plan

These extend spec §1.2. They don't replace it.

1. **Every step names a place, an artifact, a "done when" and a "stop if".** A step without all four is a checklist item, not an experiment.
2. **Every channel or claim in a kit links to a saved source or is labelled "suggestion".** Same rule as citations.
3. **First-hand evidence is shown separately from web evidence and never passes the web gate.** It can raise or lower *confidence* through a versioned rule. It never changes the 70/85 caps or `evidenceGate()`.
4. **Commitments outrank opinions.** Payment > deposit/letter of intent > pre-signup with intent > interview with a current workaround or spend > interview with a compliment only. The last one counts as zero.
5. **On-demand generation is metered and capped like a run.** No unmetered model calls (spec §3.2).
6. **Draft, never send.** The founder sends every message from their own accounts.

---

## 4. Success measures and how to read them

| Metric | Definition | Source | Baseline |
|---|---|---|---|
| **30-day action rate** (primary, spec §1.3) | Share of founders with a completed report who complete ≥1 validation task, or log ≥1 first-hand evidence row, within 30 days | `product_events` (`task_completed`, new `evidence_logged`) | Measured in WP-15 before WP-16 ships |
| Sprint start rate | Share of opportunity-page viewers who start a sprint | `sprint_created` / opportunity views (new event `opportunity_viewed`, WP-15) | WP-15 |
| Evidence logging rate | Share of sprint founders with ≥1 first-hand evidence row in 30 days | `evidence_logged` | After WP-20 |
| Commitment rate | Share of founders with ≥1 evidence row of kind `deposit`, `loi`, `payment` or `pilot` | `first_hand_evidence` | After WP-20 |
| Decision rate | Share of sprints that end in keep, park or drop (instead of abandoned) | `sprint_decided` | Exists today |

**Small numbers warning:** the beta will have tens of founders, not thousands. Treat gate thresholds as directional and pair them with 5–10 short founder conversations. Do not claim statistical significance.

---

## 5. Work packages: overview and order

| Order | WP | Feature (backlog #) | Depends on | Size* |
|---|---|---|---|---|
| **Phase 0 — Prove the base** |||||
| 1 | **WP-14** | Verification of WP-01 to WP-13 with real founders | — | M (mostly owner time) |
| 2 | **WP-15** | Quality dashboard v2 + validation funnel (#44) | WP-14 started | S |
| **Phase 1 — Test the premise cheaply** |||||
| 3 | **WP-16** | Opportunity-specific next steps (gap) | WP-15 | M |
| 4 | **WP-17** | Weekly progress email with one if-then action (#35) | WP-15, decision E2 | S |
| ⛳ | **Gate G1** | See below | WP-16, WP-17 live ≥ 3 weeks | — |
| **Phase 2 — The validation loop** |||||
| 5 | **WP-18** | Find-your-buyers kit (#24) | G1 | M |
| 6 | **WP-19** | Interview kit + log (#25) | WP-18 (shares kit storage) | M |
| 7 | **WP-20** | First-hand evidence + confidence rule (#26, #28) | WP-19 | L |
| 8 | **WP-21** | Go/no-go checks + decision log (#29, #22) | WP-20 | S |
| ⛳ | **Gate G2** | See below | WP-18 to WP-21 live ≥ 4 weeks | — |
| **Phase 3 — Sharper method and the offer test** |||||
| 9 | **WP-22** | Reachability dimension, methodology v4 (gap) | G2 | M |
| 10 | **WP-23** | Competitor table from evidence (#12) | WP-22 (same methodology bump) | S |
| 11 | **WP-24** | Smoke-test kit + path-to-target check (#27, #20 slim) | WP-23 | M |
| **Phase 4 — Before billing** |||||
| 12 | **WP-25** | Self-serve data export and deletion (#40) | — (can run any time) | S |
| 13 | **WP-26** | Share a report (#34) | WP-25 | M |

\*Size guide as in spec §4: S ≈ ≤1 day, M ≈ 1–3 days, L ≈ 3–5 days, for an agent plus owner review.

WP-25 is independent and can run in parallel with any phase. WP-22 and WP-23 should ship as **one** methodology bump (v4), so do them back to back or in one PR.

### Gate G1 — does a specific next step change behaviour?

Compare founders whose first report came after WP-16 with the WP-15 baseline cohort.

- **Pass:** sprint start rate or 30-day action rate rises by **≥ 5 percentage points**, **and** most of 5 founder conversations say the steps were usable as written. → Build Phase 2.
- **Fail:** neither moves. The bottleneck is motivation or fit, not instructions, and Phase 2 kits are unlikely to help. → Owner reviews before more feature work. Options: concierge validation (§9), narrower audience, or onboarding changes.

### Gate G2 — will founders record real-world evidence?

- **Pass:** **≥ 15%** of founders with an active sprint log ≥1 first-hand evidence row within 30 days. → Build Phase 3.
- **Fail:** founders read kits but don't log. Simplify logging (WP-20 quick-log) and re-measure once before going further.

---

## 6. Work packages in detail

### WP-14 — Verification of WP-01 to WP-13 with real founders

**Why:** `docs/IMPLEMENTATION_STATUS.md` lists every v1 package as "Implemented but not verified", most of them tested against a local stand-in for Supabase. WP-12 is still a draft PR. Building eleven more packages on unverified ground compounds the risk.

**Design**
1. Merge or close WP-12 (`20261111130000_library.sql` is not applied yet).
2. Owner recruits **10–20 beta founders** (decision E1). Each completes onboarding, at least one run, and opens at least one opportunity.
3. With owner cost approval, run the WP-01 quality evaluation once (D4: development project, ≤ $5).
4. For each WP-01 to WP-13, move its status to "Implemented and tested" or record what failed. Fix blockers in separate PRs.
5. Hold a 15-minute conversation with at least 5 beta founders. Ask what they did after reading the report, not whether they liked it.

**Files:** `docs/IMPLEMENTATION_STATUS.md`, fixes as found.

**Acceptance**
- [ ] Every WP-01 to WP-13 row has an evidence-backed status.
- [ ] At least 10 real completed runs by founders other than the owner.
- [ ] Conversation notes summarised (no personal data) in `docs/IMPLEMENTATION_STATUS.md` or a linked note.

---

### WP-15 — Quality dashboard v2 + validation funnel (#44)

**Why:** gates G1 and G2 need numbers. Today `/admin/quality` reports research quality, not what founders do afterwards.

**Design**
1. **New events** in `lib/events-core.ts` (strict schemas, no personal data):
   - `opportunity_viewed: {}`, recorded once per founder per opportunity per day (server side, in the opportunity page's data load; **VERIFY** the best hook).
   - `evidence_logged: { kind }` (used from WP-20; add the schema now so the dashboard is ready).
   - `kit_generated: { kind: "buyers" | "interview" | "offer" }` (used from WP-18).
2. **Funnel section on `/admin/quality`**, by 7/30/90-day window and by **first-report cohort week**:
   - founders with a completed report → viewed an opportunity → started a sprint → completed ≥1 task → logged ≥1 evidence row → recorded a decision;
   - the 30-day action rate (§4);
   - median days from first report to first completed task.
3. Pure computation in `lib/quality-metrics.ts` (extend), unit-tested like the existing metrics. Structural data only (D5).

**Files:** `lib/events-core.ts`, `lib/events.ts`, `lib/quality-metrics.ts`, `components/admin-quality.tsx`, the opportunity page data loader, a migration only if `product_events` has a check on event names (**VERIFY** `20261110120000_product_events.sql`).

**As built (2026-11-11):**
- `opportunity_viewed` is recorded at most once per founder per UTC **day**, not per opportunity per day, so the event needs no opportunity id. The funnel counts founders, so nothing is lost.
- Ticking one of the fixed first steps outside a sprint now records `task_completed { origin: "checklist" }`; sprint ticks record `origin: "sprint"`. Before this, only sprint ticks were recorded, which would have understated the 30-day action rate.
- The funnel lives in its own module, `lib/validation-funnel.ts`, rather than in `lib/quality-metrics.ts`.
- The 30-day action rate uses founders whose first report is between `days + 30` and 30 days old, so every founder counted has had the full 30 days.
- No migration was needed: `product_events` has no list of event names.

**Tests:** event schemas; funnel maths on fixtures (empty, one founder, cohort boundaries); 30-day window edges.

**Acceptance**
- [ ] The funnel and the 30-day action rate show on `/admin/quality` for real data.
- [ ] A baseline value is recorded in `docs/IMPLEMENTATION_STATUS.md` before WP-16 merges.

---

### WP-16 — Opportunity-specific next steps

**Why:** every opportunity page shows the same four `firstSteps` (`lib/sprint-core.ts:15-20`). The evaluation already returns 2–4 `validation` strings (`evaluationDraftSchema`, `lib/research-core.ts`), but as plain text with no place, artifact or stop rule. This is the cheapest test of the thesis (§1.3).

**User stories**
- As a founder, each next step tells me **where** to go (linked to a source when one exists), **what** to send or ask, **when it counts as done**, and **when to stop or change course**.
- When I start a sprint, those details become the task details, with due dates.

**Design**
1. **Evaluation output.** Add an optional `steps` array to the evaluation draft and item schemas, alongside `validation` (which stays, for old readers and for SQL seeding):
   ```ts
   step: z.object({
     action: prose(300),                  // imperative, specific: "Message 10 people who posted about X"
     where: z.string().nullable(),        // a source_key from this candidate's evidence, or null
     where_hint: prose(200),              // plain-text place when `where` is null; shown as "suggestion"
     artifact: prose(500),                // what to send, ask or show; a draft the founder edits
     done_when: prose(200),               // a countable outcome: "3 replies", "5 conversations booked"
     stop_if: prose(200),                 // what result means change channel, or drop the assumption
     tests_assumption: z.number().int(),  // index into this item's assumptions[]
     day: z.number().int(),               // suggested day offset within a 14-day sprint, 1–14
   })
   ```
   - 2–4 steps per candidate. The normaliser (`normalizeEvaluation`) drops a step's `where` if it is not a `source_key` saved for this candidate (same rule as claim citations), clamps `day`, clips text, and derives `validation[]` from `action` if the model left `validation` empty.
   - Prompt: steps must test the riskiest assumption first, ask about past behaviour rather than opinions [S5], and never promise results. Keep the untrusted-data sentence (spec §3.2).
   - This changes payload shape, not scoring or gating, so it **does not** bump the methodology version. Record `steps_version: 1` on the evaluation payload so readers can tell.
2. **Cost.** Steps add output tokens to the existing evaluation call. Re-run `estimateRunCost` and confirm the $0.25 default still finishes a run with Qwen 3.8 Flash (README). If not, stop and ask the owner (decision E3).
3. **Opportunity page.** When `steps` exist, show them in the Validation tab in place of the four fixed first steps. Each step shows: action; where (source title + link, or the hint labelled "suggestion"); a collapsible "what to send"; done when; stop if.
   - **Keep `firstSteps` for opportunities without `steps`.** Their ticks are stored by index in `saved_opportunities.completed_tasks`, so their order must not change (comment at `lib/sprint-core.ts:12-14`).
4. **Sprint seeding.** Extend `start_validation_sprint` (new migration; never edit `20261111120000_validation_sprints.sql`) so that, when `steps` exist:
   - it seeds one task per step: title = action, detail = "Where: … · Done when: … · Stop if: …" (≤ 1000 characters), due date = start + `day` scaled to the sprint length;
   - it does **not** seed the four `firstSteps`;
   - otherwise it behaves exactly as today.
   - Prefill `go_criteria` from the steps' `done_when` lines, which the founder can edit.
5. **Demo:** one fixed opportunity with steps.
6. **Events:** none new (uses `sprint_created`, `task_completed`).

**Files:** `lib/research-core.ts` (schemas, normaliser, prompt), `lib/research-budget.ts`, `lib/opportunity-view.ts`, `components/opportunity-detail.tsx`, `components/validation-sprint.tsx`, `lib/sprint-core.ts`, a new migration, `lib/demo-data.ts`, messages.

**As built (2026-11-12):**
- **No `artifact` field.** An evaluation batch of two ideas was estimated at ~4,500 output tokens against a 7,000-token cap on Qwen 3.8 Flash; message drafts for every step could push Chinese reports over the cap and fail runs. Steps carry action, where, done-when, stop-if, the assumption tested and a day; the messages to send belong to WP-18 and WP-19. Validation steps are now asked for under 200 characters each to offset the extra output.
- **2–3 steps** are requested (at most 4 are kept, so ticks stay within the page's four positions). An evaluation with fewer than two usable steps keeps the plain validation steps.
- **One checklist, by position.** For a report with steps, the steps replace the fixed first steps on the page and are ticked in the same `completed_tasks` positions, so a sprint carries those ticks over; WP-15 records each tick. The page header's "What to test first" becomes the first step.
- **Labels from the page.** The sprint function takes `p_labels` (where, where to look, done when, stop if) in the founder's language and writes the task details with them; English is the fallback. The old three-argument signature is replaced, not overloaded.
- **Demo:** fixed, illustrative steps (`demoSteps`) drive the demo page, its example sprint and the demo dashboard.
- **Export:** Markdown and print list each step with where, done-when and stop-if.
- **Cost:** `typicalRun.evaluation` re-estimated (6,800 in / 5,200 out per batch); Gemini 3.8 Flash's required budget rises from $0.5675 to $0.5789, still under the $0.63 a budget saved with headroom holds.

**Tests:**
- normaliser: unknown `where` dropped; `day` clamped; `validation` derived when empty; old payloads without `steps` unchanged;
- SQL: sprint from an opportunity with steps seeds them (no first steps) with scaled dates; without steps behaves as before; earlier ticks still carried over;
- view: steps preferred over `firstSteps` only when present.

**Acceptance**
- [ ] New reports show 2–4 specific steps per opportunity in all three languages, each with done-when and stop-if, and a linked source where one exists.
- [ ] A sprint started from such an opportunity carries the steps as tasks with details and spread dates.
- [ ] Old reports and old sprints behave exactly as before.
- [ ] Run cost estimate re-checked and recorded.

---

### WP-17 — Weekly progress email with one if-then action (#35)

**Why:** follow-through improves when the plan says when and where [S4]. The email sender from WP-08 (`lib/notify.ts`, `lib/notify-core.ts`) already exists.

**Design**
1. **Who:** founders with an active sprint, `notify_weekly` on (new column on `founder_profiles`, default **on** or **off** per decision E2), and at least one open task.
2. **When:** a weekly cron route (new, beside `app/api/cron/stale-runs`, using `lib/cron-auth.ts`). Day and hour from `app_settings` (default Monday 08:00 UTC; **VERIFY** Vercel cron limits on the plan).
3. **What:** one email per founder, in the report language:
   - sprint day *n* of *m*, tasks done/total;
   - **the one next task**, phrased as an if-then plan: "If it's [day the founder chose, or 'this Tuesday evening'], then I will [task action]. Done when: [done_when]."
   - one link back to the sprint; one-click opt-out link.
   - No streaks, badges or guilt copy (spec non-goal).
4. **Idempotency:** `validation_sprints.last_weekly_at` (or a small `weekly_digests` table keyed by founder + ISO week) so a retried cron never sends twice.
5. Respect the existing rules: production-only sending, `NOTIFY_DRY_RUN`, mailbox daily limits (README). If the eligible count exceeds the configured daily cap, send the oldest sprints first and log the rest.
6. **Event:** `weekly_email_sent: {}`, and `weekly_email_opened` only if a privacy-safe method is approved (default: don't track opens).

**Files:** `app/api/cron/weekly/route.ts` (new), `lib/notify-core.ts` (builder), `lib/notify.ts`, `components/notification-settings.tsx`, `vercel.json`, a migration, messages, the privacy notice (new email purpose).

**Tests:** eligibility; one email per founder per week; language; opt-out link; dry-run mode; daily cap ordering.

**As built (2026-11-12), decision E2: on by default, an opt-out link in every email, a switch on the profile.**
- **Daily cron, weekly email.** `/api/cron/weekly-progress` runs every day at 01:23 UTC; `weekly_emails` allows one email per founder per week (Monday to Sunday, UTC). The Monday run reaches almost everyone; later runs catch sprints that have just become old enough, failed sends (the claim is released) and anyone over `NOTIFY_WEEKLY_MAX`. Day and hour are set in `vercel.json`, not `app_settings`.
- **Who:** an active sprint more than 3 days old with an open task; `notify_weekly` not turned off; a confirmed address. One email per founder, about the sprint whose next task is due soonest.
- **What:** the opportunity's title, the sprint day and progress, the one next task with its details and due date, and "pick a day and time for it now"; in the report's language. No streaks or guilt.
- **Opt-out without signing in:** the link opens `/unsubscribe`, which confirms with a button that POSTs; a GET changes nothing, because email scanners open links. RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post` headers give mail apps their own one-click button. Links are HMAC-signed per founder with `NOTIFY_LINK_SECRET` (or `CRON_SECRET`); without a secret the email links to the profile page.
- **Event:** `weekly_email_sent {}` on real sends only. Opens are not tracked.

**Acceptance**
- [ ] In dry-run, a cron call logs exactly one correct email per eligible founder and none twice.
- [ ] Opt-out works from the email and from the profile.
- [ ] Privacy notice updated and owner-approved.

---

### WP-18 — Find-your-buyers kit (#24)

**Why:** this is the direct answer to "distribution is harder than ideas", without promising customers. The source policy already steers searches toward communities where buyers discuss their own work (README, "Breadth"), so many reports already hold the places buyers gather.

**User stories**
- As a founder, I get a short list of **where these buyers are**, **who exactly to approach**, and **a first message I can edit**. Every place links to a saved source or is labelled "suggestion".

**Design**
1. **Generated on demand per opportunity**, not during every run, so runs don't get slower or costlier for founders who never use it. Whether generation uses a run slot or a separate small allowance is decision E4.
2. **Storage:** one table for all kits (reused by WP-19 and WP-24):
   - `opportunity_kits`: `id`, `user_id`, `opportunity_id`, `kind text check in ('buyers','interview','offer')`, `payload jsonb`, `kit_version int`, `language`, `cost_usd numeric`, `created_at`;
   - RLS per spec §3.1, composite foreign keys; at most one current kit per (opportunity, kind); regenerating replaces it, keeping the previous one for 30 days for undo (**VERIFY** that fits D6-style retention).
3. **Generation:** a server route calls one metered `structured` call (through `providerCall`; budget from `app_settings.kits.max_usd`, default to be set after measuring, decision E3) with:
   - the opportunity's buyer, pain, assumptions, steps;
   - its saved evidence (`research_evidence`: URL, title, excerpt, classification) as **untrusted data**;
   - the founder's `distribution` and `strength` profile fields.
4. **Kit payload** (normalised server side):
   - `channels[]` (3–6): `{ name, kind: "community" | "association" | "event" | "directory" | "job_title" | "marketplace", source_key | null, why, how_to_find_people }`. Unknown `source_key` → null → shown as "suggestion".
   - `first_ten[]`: how to find 10 named people, as steps, without fetching or storing anyone's personal data.
   - `messages[]` (2–3): first-contact drafts for different channels, each ≤ 600 characters, asking about past behaviour [S5], with a note on each platform's self-promotion rules where known.
   - `avoid[]`: channels that look tempting but the evidence argues against.
5. **UI:** a "Buyers" section on the opportunity page with a "Create my buyers kit" button, cost/slot notice, the kit, copy buttons on messages, and "Add to sprint" on each channel (creates a task).
6. **Event:** `kit_generated { kind: "buyers" }`.

**Files:** new migration, `lib/kits-core.ts` (schemas, normaliser, prompt), `lib/kits.ts` (server), `app/api/kits/route.ts`, `components/buyers-kit.tsx`, `components/opportunity-detail.tsx`, `lib/research-budget.ts`, demo fixture, messages, privacy notice (new processing purpose).

**Tests:** normaliser (unknown source → suggestion; message length; 3–6 channels); SQL RLS isolation; one current kit per kind; budget refusal; demo never calls the API.

**Acceptance**
- [ ] A founder can generate, read, copy from and regenerate a buyers kit in all three languages.
- [ ] Every channel shows its source link or the "suggestion" label.
- [ ] Generation is metered, capped, and refused cleanly when the budget can't pay for it.

---

### WP-19 — Interview kit + log (#25)

**Why:** conversations are the cheapest first-hand evidence. Scripts that ask about past behaviour avoid false positives [S5].

**Design**
1. **Interview kit** (`opportunity_kits.kind = 'interview'`, same generation path as WP-18):
   - a 3–5 question **screener** (is this person the buyer?);
   - a 6–10 question **script**: past behaviour, current workaround, current spend, who decides the budget, last time the problem happened; **no** questions that pitch the idea or ask "would you use/pay";
   - "**signals to listen for**", mapped to the opportunity's assumptions.
2. **Interview log** table `interviews` (RLS, composite foreign keys to opportunity):
   - `held_on date`, `persona text ≤200`, `channel text ≤200`;
   - `pain int 1–5`, `workaround text ≤500`, `current_spend_minor bigint null`, `currency char(3) null`;
   - `budget_owner text ≤200`, `key_quote text ≤500`, `next_step text ≤300`;
   - `assumption_index int null` (which assumption it tested), `outcome text check in ('supports','contradicts','unclear')`;
   - `consent_note text ≤300`.
   - **No contact details or names of interviewees.** The form says so.
3. **UI:** "Interviews" section on the opportunity page: kit, "Log an interview" form (under 60 seconds to fill in), list with outcomes per assumption.
4. **Event:** `interview_logged: { outcome }`.

**Files:** migration, `lib/interviews-core.ts`, `lib/interviews.ts`, `app/api/interviews/route.ts`, `components/interview-kit.tsx`, `components/interview-log.tsx`, kits code from WP-18, demo, messages, privacy notice.

**Tests:** schema bounds; RLS; no personal-data fields; script normaliser rejects pitch-style questions it can detect (e.g., "would you pay", "would you use"), dropping them.

**Acceptance**
- [ ] A founder can generate an interview kit and log, edit and delete interviews.
- [ ] Interviews show grouped by the assumption they tested.

---

### WP-20 — First-hand evidence + confidence rule (#26, with #28 merged)

**Why:** this is the moat (§1.3). It is also the reason to come back: the founder's own evidence changes what the report says.

**Design**
1. **Table `first_hand_evidence`** (RLS, composite foreign keys):
   - `kind text check in ('interview','signup','loi','deposit','payment','pilot','rejection')`;
   - `occurred_on date`, `count int default 1` (e.g., 23 sign-ups), `amount_minor bigint null`, `currency char(3) null`;
   - `assumption_index int null`, `stance text check in ('supports','contradicts')`;
   - `note text ≤500`, `link text null` (the founder's own proof, e.g. a payment receipt URL; validated with `safeSourceUrl`), `interview_id uuid null` (WP-19 rows create one evidence row automatically).
   - Pilots and pre-sales from #28 are kinds here, with amounts in minor units. No separate tracker.
2. **Quick log:** a one-line "Log evidence" control on the opportunity page and in each sprint task ("Done — log what happened").
3. **Confidence rule** (pure, versioned, `lib/first-hand-core.ts`, `FIRST_HAND_RULE_VERSION = 1`):
   - Weights follow principle 4 (§3): payment, pilot > deposit, LOI > sign-up with stated intent > interview `supports` with workaround or spend > interview `supports` without. Compliment-only interviews count as zero.
   - Output: a **validation status** ladder shown beside the web score, never folded into it:
     `Not started` → `Talking to buyers` (≥3 interviews) → `Problem confirmed` (≥5 interviews, ≥60% supporting the riskiest assumption) → `Commitment seen` (≥1 sign-up with intent, LOI or deposit) → `Paid` (≥1 payment or paid pilot).
   - `contradicts` rows can move the status down, and are shown first.
   - Thresholds live in `app_settings` (spec §3.1), not in code or check constraints.
   - **Never** changes `evidenceGate()`, the web score, or the 70/85 caps.
4. **Report display:** a "Your evidence" panel on the opportunity page and in exports (WP-11 Markdown/PDF), clearly labelled as reported by the founder.
5. **Event:** `evidence_logged: { kind }`.

**Files:** migration, `lib/first-hand-core.ts`, `lib/first-hand.ts`, `app/api/evidence/route.ts`, `components/first-hand-evidence.tsx`, `components/opportunity-detail.tsx`, `components/validation-sprint.tsx`, `lib/report-export.ts`, demo, messages.

**Tests:** the status ladder at every threshold boundary; contradicting evidence lowering it; rule version stored; SQL RLS; amounts in minor units; export includes the panel with its label.

**Acceptance**
- [ ] Founders can log every kind in under 30 seconds and see the status change.
- [ ] Web score, gate and caps are provably unchanged (existing tests pass, plus a test that logging evidence doesn't alter them).

---

### WP-21 — Go/no-go checks + decision log (#29, with #22 merged)

**Why:** sprints already store free-text `go_criteria` and a keep/park/kill decision (`lib/sprint-core.ts`). With evidence rows (WP-20), criteria can be checked, and decisions can be recorded without a sprint.

**Design**
1. **Structured criteria** (optional, alongside the free text): up to 5 rows of `{ metric: "interviews" | "supporting_share" | "signups" | "commitments" | "revenue_minor", op: ">=", value }`, saved on the sprint (`go_checks jsonb`, validated).
2. **Check panel:** each criterion shows met / not met from WP-20 data, and the sprint's decision step suggests (never forces) keep, park or drop.
3. **Decision log (#22):** `opportunity_decisions` table (or reuse the sprint decision columns plus a sprint-less path; **VERIFY** which is simpler) so a founder can record keep/park/drop and a note on any opportunity. Show a decision history on the opportunity page and a "Dropped" filter in the library (WP-12).
4. **A drop is a result.** The decision screen shows what was learned and how long it took ("You dropped this in 9 days, after 6 interviews"), in line with spec principle 4.

**Files:** migration, `lib/sprint-core.ts`, `components/validation-sprint.tsx`, `components/library.tsx`, `lib/library-core.ts`, messages.

**Tests:** criterion evaluation on fixtures; suggestion logic; decision without sprint; library filter.

**Acceptance**
- [ ] A founder can set structured criteria, see them checked, and record a decision with or without a sprint.

---

### WP-22 — Reachability dimension, methodology v4

**Why:** today's five dimensions (`pain`, `demand`, `economics`, `feasibility`, `advantage`; `scoringWeights` in `lib/research-core.ts`) don't score whether the founder can reach buyers. `plan.md` M1 proposed customer reachability at 20%.

**Design**
1. Add a sixth dimension `reachability` (0–100) to the evaluation draft and stored schemas: can this founder reach 50 named buyers within 2 weeks, through channels the evidence shows exist, given their profile's `distribution` field?
2. **New weights** for methodology v4 (owner to confirm, decision E5). Suggested starting point, keeping the existing shape:
   - founder: pain 0.2, demand 0.15, economics 0.15, feasibility 0.15, advantage 0.15, reachability 0.2;
   - market: pain 0.25, demand 0.25, economics 0.15, feasibility 0.15, advantage 0, reachability 0.2;
   - combined and verify: pain 0.2, demand 0.2, economics 0.15, feasibility 0.1, advantage 0.15, reachability 0.2.
3. **Reachability cap:** when no supporting source shows a place buyers gather (a classification flag added in this WP, e.g. `shows_buyer_venue: boolean`), cap the reachability dimension at 40 and say why. This is a scoring rule, not a gate. The evidence gate is unchanged.
4. **Methodology v4:** bump `METHODOLOGY_VERSION` to 4. v1–v3 reports keep reading their stored dimensions and weights (spec principle 6). The opportunity page shows reachability only when present.
5. Re-run `estimateRunCost`; extend the quality evaluation briefs (WP-01) with 3 briefs where reachability should be low.

**Files:** `lib/research-core.ts`, `lib/research-engine.ts`, `lib/report-presentation.ts`, `lib/opportunity-view.ts`, `components/score-chart.tsx`, `components/score-scale.tsx`, tests, `tests/fixtures/eval-briefs.json`, messages.

**Tests:** weights sum to 1 per mode; cap applies only without a venue source; v3 payloads score exactly as before; v4 version recorded.

**Acceptance**
- [ ] New reports show six dimensions; old reports are unchanged.
- [ ] The cap and its reason appear when no buyer venue is evidenced.

---

### WP-23 — Competitor table from evidence (#12)

**Design:** as specified in spec §6 #12. The evaluation outputs `competitors[] { name, url, price_seen, observed_weakness, source_key }`; the normaliser drops any entry whose URL is not a saved source. Shown in the Evidence tab. Ship in the **same methodology bump as WP-22**.

**Why now:** WP-24's price hypothesis needs observed price anchors.

**Acceptance**
- [ ] Every competitor row links to a saved source; none is invented.

---

### WP-24 — Smoke-test kit + path-to-target check (#27, #20 reshaped)

**Why:** VentureLens reports already propose smoke tests as the way to disprove an opportunity ("if fewer than 2% convert…"). This WP gives the founder the materials and the arithmetic.

**Design**
1. **Offer kit** (`opportunity_kits.kind = 'offer'`, generation as WP-18):
   - one-sentence offer; headline and 3 benefit lines for a landing page;
   - a price hypothesis **anchored on WP-23 prices seen** (each anchor cited);
   - the call to action design: pre-order, deposit, waitlist with a qualifying question, or "book a call";
   - **metrics to watch and kill threshold** (visitors, conversion to the call to action, cost per visitor if paid traffic);
   - export as plain text and as a block formatted for common no-code page builders. **No hosting** (spec non-goal).
2. **Path-to-target check** (the slim #20), a pure function in `lib/economics.ts` with no AI:
   - inputs: monthly revenue target (prefilled from the profile's `revenue_target`), price, expected monthly churn, conversion rates from conversations to trials and trials to paid (prefilled only from the founder's own WP-20 data when present, otherwise blank with an "assumption" label);
   - outputs: customers needed, conversations needed per month, and months to target at the founder's weekly hours;
   - one screen, editable, saved per opportunity. No 12-month projection, no "probability".
3. **Event:** `kit_generated { kind: "offer" }`.

**Files:** kits code, `lib/economics.ts`, `components/offer-kit.tsx`, `components/path-to-target.tsx`, migration for saved inputs, demo, messages.

**Tests:** economics maths (zero churn, 100% churn, rounding); assumptions labelled; prices in the kit cite saved sources.

**Acceptance**
- [ ] A founder can produce a smoke-test brief and see how many conversations their target needs, with every input labelled observed or assumption.

---

### WP-25 — Self-serve data export and deletion (#40)

**Design:** as specified in spec §6 #40: export all of a founder's data as JSON (profile, briefs, runs, reports, evidence, sprints, kits, interviews, first-hand evidence, decisions); delete the account with typed confirmation, following D6 for usage rows. Update the privacy notice.

**Why before billing:** founders will log commercially sensitive notes and amounts from WP-19 and WP-20. They need a way to take their data and leave.

**Acceptance**
- [ ] Export contains every user-owned table added by this plan.
- [ ] Deletion removes all of them (SQL test across every table).

**As built (2026-11-12):**
- **Export** (`GET /api/account/export`, "Download my data" on the profile): one JSON file with every row of every founder table, read with the founder's own session (row-level security), plus `product_events` and `weekly_emails` read with the service role filtered to them. Paged past PostgREST's 1,000-row limit. `research_stages` is listed by stage and time only: its working copies are often megabytes per run, and the brief, evidence and report are exported from their own tables. A test fails if a migration adds a table with `user_id` that the export misses.
- **Deletion** (`DELETE /api/account`, "Delete my account" with the typed word): `prepare_account_deletion()` refuses while research is running, detaches the founder's usage rows (D6, as for a deleted run; before this, account deletion deleted them), and records a SHA-256 hash of the normalised address if the account had the sign-up grant; then the admin API deletes the auth user and the cascades remove every founder table. The session is signed out.
- **Abuse guard (new):** without it, deleting an account and signing up again would grant ten more free runs, because repeat sign-ups were blocked only by matching live accounts. `grant_signup_research_run` now also refuses an address whose granted account was deleted in the last 12 months. Only the hash is kept, for 12 months, and the privacy notice says so.

---

### WP-26 — Share a report (#34)

**Design:** as specified in spec §6 #34: a read-only link, unlisted by default, with profile and brief removed; moderation before anything is public.

**Additions from this plan:**
- First-hand evidence (WP-20) and interviews are **excluded by default**; the founder can include the validation status only.
- A footer link "Researched with VentureLens" on shared pages (VentureLens's own distribution channel).
- Optional advisor comments (#37) build on this later.

**Acceptance**
- [ ] A shared link shows no profile, brief, interview or evidence data unless the founder opted in, and can be revoked.

**As built (2026-11-12):**
- **Report-level links** from a completed report's page ("Share"): one live link per report, a 43-character random token, unlisted. Turning a link off is final; sharing again makes a new link, so an old one never comes back. Deleting the report or the account deletes its links.
- **The public page** `/s/<token>` renders the report with the print document: summary, opportunities with scores, claims, sources, economics and review, and the ideas that did not pass. It never shows the profile, the brief or **each score's rationale**, because the rationale explains the founder-advantage score from the founder's own background. The share dialog warns that other report text can still mention the founder's skills. First-hand evidence and interviews (WP-19, WP-20) are not built yet and are not part of the report.
- **No leaks through links:** the shared pages send no Referer (so a source site never sees the link) and are `noindex, nofollow, nocache`. Views are not counted; making and turning off a link record `report_shared` / `report_unshared`.
- **Footer:** "Researched with VentureLens" with a link to start research. There is no public listing, so moderation is not needed yet.

---

## 7. Deferred and dropped

| # | Item | Status | Revisit when |
|---|---|---|---|
| 21 | Compare 2–5 opportunities | Deferred | WP-15 shows ≥ 30% of active founders hold 3+ live opportunities |
| 31 | Build handoff | Deferred | ≥ 10 founders reach the `Commitment seen` status (WP-20). Keep it gated on validated facts only |
| 36 | Watch a saved opportunity | Deferred | After billing exists and a recurring product needs a reason to exist; judge on parked opportunities first |
| 37 | Advisor comments | Deferred | After WP-26 and an institution pilot (§9) asks for it |
| 9 | Quick sketches | **Dropped** | Only if data shows founders abandon onboarding because the first step is too heavy. Even then, prefer a faster verify mode over unverified ideas |
| 32 | Launch plan | **Dropped** | Its distribution content lives in WP-18; a 3-month generic plan contradicts §1.4 |

---

## 8. Owner decisions needed

| ID | Decision | Needed by | Suggested default |
|---|---|---|---|
| E1 | Who are the 10–20 beta founders, and how are they recruited? | WP-14 | Personal network plus 2–3 founder communities; no paid ads |
| E2 | Weekly email default: on or off for founders with an active sprint? | WP-17 | **On**, with one-click opt-out in every email (it's a service email tied to a sprint the founder started). Check local marketing-email rules first |
| E3 | Cost ceilings: per-run budget after WP-16; per-kit budget (WP-18, WP-19, WP-24) | WP-16, WP-18 | Keep the $0.25 run default if it still finishes; set the kit cap after measuring 10 kits on the development project |
| E4 | Does generating a kit use a run slot? | WP-18 | No: give each account a separate small kit allowance (e.g., 10 per 90 days), stored like `research_dev_access`, so kits don't compete with research |
| E5 | Methodology v4 weights and the reachability cap value | WP-22 | As suggested in WP-22 |
| E6 | Thresholds for the validation-status ladder | WP-20 | As suggested in WP-20, stored in `app_settings` |
| E7 | What happens if gate G1 fails? | G1 | Pause features; run the concierge test in §9 for 2–3 weeks |

---

## 9. Owner track (commercial, no code in this plan)

Billing logic stays out of the code until `plan.md` M3's entitlement ledger exists. These run alongside the WPs and decide what M3 should sell.

### 9.1 Price by phase, not by run count

The planned packages (`components/pricing.tsx`) are Opportunity Sprint ($29 once, 5 runs), Explorer ($39/month, 10 runs) and Builder ($79/month, 30 runs). Monthly run bundles fit a one-off need badly [S2], and the market sells one-time reports [S6].

| Offer | What it covers | Why |
|---|---|---|
| **Research pack** (one-time) | Runs, as today's Opportunity Sprint | Matches how the need arrives |
| **Validation pass** (one-time, 30 or 60 days) | Kits (WP-18, WP-19, WP-24), evidence log, weekly emails | Charges for the phase where this plan's value sits, and doesn't punish founders for finishing |
| **Institution seats** (per cohort) | Accounts for a programme's founders, plus a cohort view later | The only place recurring revenue fits naturally: each cohort brings new founders |

Drop the monthly Builder plan unless WP-15 data shows a group (coaches, advisors) running 20+ runs a month. If it does, sell them seats instead.

### 9.2 Tests to run before M3

| Test | Pass | Fail |
|---|---|---|
| **Concierge validation pass:** offer 20 beta founders a manual, owner-assisted validation pass for a fee | ≥ 3 pay | Recurring or pass revenue unproven; sell research packs only |
| **Institution conversations:** 10 incubators, accelerators, university entrepreneurship centres, or career-transition programmes | ≥ 1 agrees to a paid or unpaid pilot cohort | Stay direct-to-founder |
| **Message test:** landing-page variant that leads with "a null result is a result" vs one that leads with features | Honest variant converts within 20% of the other | Lead with outcomes (founders who reached a first payment) once WP-20 data exists |

---

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Building on unverified v1 work | High | WP-14 first; gates G1 and G2 |
| Kits read as generic AI output | Medium | Source-or-suggestion rule; tie every item to the opportunity's evidence; measure regenerate rates |
| Founders don't log evidence (logging is work) | High | Quick-log in tasks (WP-20); gate G2; simplify before expanding |
| Platform rules: outreach drafts used as spam | Medium | Draft-only; per-platform self-promotion notes; message length caps; no bulk features |
| Personal data in interview notes | Medium | No interviewee names or contacts in the schema; form copy says so; export/delete in WP-25 |
| Methodology v4 confuses comparisons with v3 reports | Medium | Show the methodology version on reports; don't compare scores across versions in the UI |
| Cost creep from on-demand kits | Medium | Metered, capped, separate allowance (E3, E4) |
| Small sample sizes mislead gates | High | Directional thresholds plus founder conversations (§4) |

---

## 11. Sources

- **[S1]** CB Insights, *The Top 20 Reasons Startups Fail*. <https://s3-us-west-2.amazonaws.com/cbi-content/research-reports/The-20-Reasons-Startups-Fail.pdf>
- **[S2]** RevenueCat, *State of Subscription Apps 2026*. <https://www.revenuecat.com/state-of-subscription-apps/>
- **[S3]** Reich, J. & Ruipérez-Valiente, J. A. (2019), "The MOOC pivot", *Science*; summarised by Inside Higher Ed. <https://www.insidehighered.com/digital-learning/article/2019/01/16/study-offers-data-show-moocs-didnt-achieve-their-goals>
- **[S4]** Gollwitzer, P. M. & Sheeran, P. (2006), "Implementation intentions and goal achievement: a meta-analysis of effects and processes", *Advances in Experimental Social Psychology* 38. <https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f>
- **[S5]** Fitzpatrick, R., *The Mom Test*; summary: <https://mtlynch.io/book-reports/the-mom-test/>
- **[S6]** Competitor pricing as published, checked 2026-11-11: DimeADozen <https://www.dimeadozen.ai/>; comparison of 21 validation tools <https://preuve.ai/compare>; WorthBuild comparison <https://worthbuild.io/blog/best-startup-idea-validation-tools-2026-comparison>; ValidatorAI <https://validatorai.com/>; IdeaProof <https://ideaproof.io/>. Vendor pages; prices change.
