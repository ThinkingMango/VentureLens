# VentureLens Editorial Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing dark interface with an accessible editorial design and make the complete research journey mobile-friendly with card-based output.

**Architecture:** Keep the existing Next.js routes, data flow, and components. Establish new global tokens and primitive styles first, then update shared shells and reusable output cards, then apply the system to each workflow and verify through the synthetic demo.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl, existing Radix/shadcn-style primitives, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-11-09-editorial-mobile-redesign-design.md`

## Global Constraints

- Preserve research, auth, database, provider, entitlement, pricing, export, and localization behavior.
- Do not add runtime dependencies or retain the old theme as an option.
- Use warm ivory `#F5F3ED`, soft white `#FFFEF9`, deep green ink `#17352D`, forest action `#245846`, and muted amber `#C4863C` as the core palette.
- All new literal `copy()` strings require English, Simplified Chinese, and Traditional Chinese entries.
- Essential opportunity information stays visible on mobile; touch targets are at least 44px and pages do not overflow horizontally.
- Consult `node_modules/next/dist/docs/` before using Next.js APIs and follow the installed Next.js 16 documentation.

## Review Focus

- Long translated titles, CJK copy, URLs, and prices must wrap without covering actions; browser checks in Tasks 2, 3, and 6 include 320px and Chinese locale coverage.
- Mobile fixed navigation must not cover the final CTA, validation checklist, footer, or focused fields; Task 2 adds safe-area/content padding and Task 6 exercises scrolling to every bottom action.
- Demo and live report fields differ; Task 3 preserves source counts and synthetic labels while checking both `OpportunityCard` branches.
- Tabs, drawers, filters, and selectable cards must remain keyboard-operable; Tasks 2–5 retain semantic controls and Task 6 checks focus and keyboard interaction.
- Loading, empty, error, and disabled states must remain readable against the new surfaces; Task 1 updates primitives and Task 6 checks representative states.

---

### Task 1: Editorial tokens, typography, and UI primitives

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/badge.tsx`
- Modify: `components/ui/dialog.tsx`
- Modify: `components/ui/field.tsx`
- Test: `tests/i18n.test.mjs`

**Interfaces:**
- Produces: global palette/radius/shadow tokens, `.surface`, `.page-heading`, `.field-select`, `.report-section`, `.nav-link`, progress/chart colors, and font variables consumed by every later task.
- Preserves: all existing component exports and variant names.

- [ ] **Step 1: Install the locked dependencies and inspect Next.js 16 guidance**
  Run `pnpm install --frozen-lockfile`; read the relevant installed font and CSS documentation under `node_modules/next/dist/docs/` before editing.

- [ ] **Step 2: Establish the baseline**
  Run `pnpm typecheck` and `pnpm test`. Record any pre-existing failure separately rather than treating it as a redesign regression.

- [ ] **Step 3: Replace the theme and font setup**
  Update the root palette to the spec values, add Newsreader through `next/font/google` for editorial headings, retain Geist and CJK fallbacks, update viewport theme color, and remove obsolete dark/terminal/gradient rules. Add mobile safe-area and overflow safeguards without changing route behavior.

- [ ] **Step 4: Restyle shared primitives**
  Update existing variants for forest primary actions, legible secondary text, warm card surfaces, 16–20px card radii, visible focus, pressed/hover/disabled states, 44px touch targets, and 16px mobile inputs. Keep component APIs unchanged.

- [ ] **Step 5: Verify the foundation**
  Run `pnpm typecheck` and `pnpm test`; expect both to pass with no new copy-catalog failures.

### Task 2: Public and workspace navigation shells

**Files:**
- Modify: `components/shared.tsx`
- Modify: `components/public-shell.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `components/mobile-disclosure.tsx`
- Modify: `components/language-switcher.tsx`
- Test: browser shell checks in the synthetic demo

**Interfaces:**
- Consumes: Task 1 tokens and primitive variants.
- Produces: a shared editorial `Brand`, responsive public header/menu, workspace sidebar/drawer/header, and a four-item mobile bottom navigation linking `/dashboard`, `/research`, `/saved`, and `/profile` through `workspace-link`.
- Preserves: help dialogs, language switching, logout, admin visibility, active-route logic, and skip links.

- [ ] **Step 1: Rebuild the shared brand and public shell**
  Replace the terminal-like brand treatment with the editorial mark and typography; simplify the footer and public mobile menu while preserving every real destination and large touch targets.

- [ ] **Step 2: Rebuild workspace navigation**
  Restyle the desktop sidebar and mobile drawer, keep existing route detection, add the fixed mobile bottom navigation below `lg`, and add `padding-bottom: calc(... + env(safe-area-inset-bottom))` to page content so no action is obscured.

- [ ] **Step 3: Limit mobile disclosures to secondary content**
  Keep the existing `MobileDisclosure` API for secondary material, but remove its use for essential statistics, pricing, risk, confidence, and report content in later tasks. Ensure disclosure controls expose expanded state and visible focus.

- [ ] **Step 4: Verify navigation at phone and desktop widths**
  With the dev server, open `/`, `/demo/dashboard`, and `/demo/research/results` at 390px and 1440px. Open/close both menus, use skip links, activate every bottom-nav destination, scroll to each page bottom, and confirm no covered content or horizontal page overflow.

- [ ] **Step 5: Run regression checks**
  Run `pnpm typecheck` and `pnpm test`; expect both to pass.

### Task 3: Card-based opportunity output and report reading

**Files:**
- Modify: `components/opportunity-card.tsx`
- Modify: `components/research-results.tsx`
- Modify: `components/research-report.tsx`
- Modify: `components/opportunity-detail.tsx`
- Modify: `components/opportunity-evidence.tsx`
- Modify: `components/evidence-preview.tsx`
- Modify: `components/score-chart.tsx`
- Test: browser result/report checks using `/demo/research/results` and `/demo/opportunities/proposal-copilot`

**Interfaces:**
- Consumes: Task 1 primitives and Task 2 navigation spacing.
- Produces: the canonical mobile-visible `OpportunityCard` hierarchy: score/confidence/save, title/description, buyer, pricing, evidence/demo status, key risk, and Read report action.
- Preserves: `WorkspaceOpportunity` input, saving, source counts, filtering, sorting, comparison, export, report tabs, validation checklist, and all live/demo branches.

- [ ] **Step 1: Refactor the canonical opportunity card**
  Recompose the existing card without changing its props. Keep pricing, confidence, and key risk outside `MobileDisclosure`; make save and report actions full-width where appropriate on phones, retain accessible labels, and let text wrap naturally.

- [ ] **Step 2: Simplify results and report shortlist**
  Convert summary and filters into clear cards, keep search visible, retain Cards as the default view, preserve the accessible comparison region and empty states, and use the canonical card consistently in demo, saved, dashboard, and live report views.

- [ ] **Step 3: Refactor opportunity detail into readable cards**
  Keep the four keyboard-accessible tabs; make the tab list horizontally scrollable only internally on phones, present overview/source/economic/validation sections as cards, and position score breakdown after main content on phones and in a supporting column on wide screens.

- [ ] **Step 4: Verify every output interaction**
  At 320px and 390px, confirm buyer, price, confidence, risk, and demo/source status are visible without expansion. Exercise search, empty/clear filters, confidence filter, both sorts, Cards/Compare, save/unsave, export, all four tabs, tab arrow/Home/End keys, source dialog, and validation checkboxes. Repeat at 1440px.

- [ ] **Step 5: Run regression checks**
  Run `pnpm typecheck` and `pnpm test`; expect both to pass.

### Task 4: Research setup, dashboard, history, and progress

**Files:**
- Modify: `components/dashboard.tsx`
- Modify: `components/research-library.tsx`
- Modify: `components/research-config.tsx`
- Modify: `components/research-run.tsx`
- Modify: `components/live-workspace.tsx`
- Test: browser research-flow checks using `/demo/research/new` and existing unit suites

**Interfaces:**
- Consumes: the canonical `OpportunityCard`, shared cards, fields, buttons, and workspace shell.
- Produces: visible mobile metric cards, research-history cards on narrow screens, grouped research brief cards, and a responsive progress/status timeline.
- Preserves: request idempotency, API retries, validation, submission redirects, SWR refresh, retry rules, model/budget metadata, and access states.

- [ ] **Step 1: Refactor dashboard and research history**
  Lead with the welcome/new-research action, show all four metric cards in a two-column mobile grid, reuse opportunity cards, and present run status/date/count/open actions in mobile cards while preserving wide-screen structure.

- [ ] **Step 2: Refactor research configuration**
  Group existing fields into research focus, discovery preferences, constraints, and review/submit cards. Keep labels/help/errors persistent, stack fields on phones, and leave the research pipeline explanation secondary without changing form values or submission logic.

- [ ] **Step 3: Refactor run progress and execution details**
  Use a status card with current stage and explanation, a vertical mobile step list and wider desktop layout, and collapsible execution metadata only after completion. Preserve all failure, retry, cost, token, and refresh messages.

- [ ] **Step 4: Verify the research flow**
  In demo mode, submit an empty name and confirm inline focus/error; complete a valid brief and confirm results open. Check access-blocked/loading/failed presentation through existing fixtures or component states without issuing live provider calls.

- [ ] **Step 5: Run regression checks**
  Run `pnpm typecheck` and `pnpm test`; expect all research and API tests to pass unchanged.

### Task 5: Public pages, authentication, onboarding, and account screens

**Files:**
- Modify: `components/landing.tsx`
- Modify: `components/pricing.tsx`
- Modify: `components/auth-screen.tsx`
- Modify: `components/onboarding.tsx`
- Modify: `components/profile-choice.tsx`
- Modify: `components/billing.tsx`
- Modify: `components/support.tsx`
- Modify: `components/privacy.tsx`
- Modify: `app/not-found.tsx`
- Modify: `app/error.tsx`
- Modify: `app/loading.tsx`
- Modify: `messages/en.json`, `messages/zh-Hans.json`, `messages/zh-Hant.json` only if new copy is introduced

**Interfaces:**
- Consumes: all shared primitives and shells from Tasks 1–2.
- Produces: the editorial landing/sample output, consistent supporting pages, focused auth forms, mobile-readable four-step profile flow, and selectable option cards using existing form state.
- Preserves: email-code flow, return paths, validation, profile values, planned-pricing notices, legal copy, support contacts, and error recovery.

- [ ] **Step 1: Rebuild the landing page around the approved story**
  Use an asymmetrical hero with a visible sample opportunity card, then research steps, report contents, evidence rules, audiences, FAQ, and final CTA. Remove dark bands and generic gradient treatments without changing product claims or destinations.

- [ ] **Step 2: Apply the system to public and account pages**
  Update pricing cards and notices, support/privacy/not-found/loading/error layouts, and billing through shared components; preserve legal wording and planned-payment behavior.

- [ ] **Step 3: Refactor authentication and onboarding**
  Use single-column mobile forms and desktop context panels where space permits. Keep step progress and Back/Continue positions consistent; style existing option groups as large semantic selectable cards without changing their values or validation.

- [ ] **Step 4: Add translations for any new copy**
  Use `node scripts/i18n-merge.mjs entries.json` for each new source string and remove the temporary entries file after merging. Prefer existing copy when meaning is unchanged.

- [ ] **Step 5: Verify public and profile flows**
  Check landing anchors/menu/CTAs, pricing planned-package toast, auth email/code presentation and validation, onboarding step focus/back/continue, option selection, profile save, and all supporting pages at 390px and 1440px.

- [ ] **Step 6: Run regression checks**
  Run `pnpm typecheck` and `pnpm test`; expect i18n, email-auth, and workspace tests to pass.

### Task 6: Full responsive, accessibility, and production verification

**Files:**
- Modify: only files implicated by verified defects from Tasks 1–5
- Test: existing unit suites, production build, and desktop browser

**Interfaces:**
- Consumes: the complete redesigned application.
- Produces: a verified deliverable with no unintended backend or generated-file changes.

- [ ] **Step 1: Run all standard project checks**
  Run `pnpm typecheck`, `pnpm test`, and `pnpm build`; all must pass on the final tree. Do not run the credentialed integration test or paid research E2E test.

- [ ] **Step 2: Exercise the complete synthetic demo**
  In the built-in browser, traverse landing → dashboard → new research → results → save/filter/sort/compare → opportunity tabs/source/validation → profile. Confirm state and navigation behavior, not just rendering.

- [ ] **Step 3: Inspect responsive and localized layouts**
  Check 320px, 390px, 768px, and 1440px widths; switch to Simplified and Traditional Chinese on representative landing, card, form, and detail views. Confirm no page overflow, clipped controls, covered footer actions, unreadable text, or unintended iOS-sized input zoom.

- [ ] **Step 4: Check accessibility and resilience**
  Verify visible keyboard focus, semantic headings, skip links, drawer/dialog focus return, tab keyboard controls, 44px touch targets, reduced motion, empty states, disabled/busy states, and readable error messages.

- [ ] **Step 5: Review the final workspace**
  Run `git status --short` and `git diff --stat`; remove only artifacts created by verification, confirm no API/workflow/database changes, and report any environment-dependent checks that could not be exercised.
