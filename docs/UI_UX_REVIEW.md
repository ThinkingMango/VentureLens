# VentureLens AI: UI/UX Review and Design Skills (November 2026)

> **Scope:** follow-up to §6 of [`REVIEW.md`](./REVIEW.md). Every public and `/demo/*` route was screenshotted at 1440×900 and 390×844, in light mode before the changes and in light and dark mode after them. The audit applied the design skills listed in §1.
> **Not covered:** signed-in live screens with real data (they need Supabase credentials). They share the components changed here, so they inherit the changes.

---

## 1. Skills used, and when to use each

These are already installed in this Claude workspace. Invoke one by name (for example `/design:design-critique`) or ask for the task it covers.

| Skill | What it gives you | Use it when | Used here for |
| --- | --- | --- | --- |
| `design:design-critique` | A fixed critique frame: first impression, usability, hierarchy, consistency, accessibility, then prioritised fixes | You want a structured review of a screen before changing it | The findings in §2 |
| `frontend-design:frontend-design` | Rules for a distinct visual identity: a token plan before any code, restraint, one memorable element, and a list of signs of a generated page | Building or reshaping UI | Token and dark-palette plan; making the score the one visual anchor on a card |
| `anthropic-skills:design-taste-frontend` | An "anti-slop" checklist covering hero rules, eyebrow limits, card discipline, contrast checks, dark mode and reduced motion | **Marketing pages only.** The skill itself says it is out of scope for dashboards and product UI | Contrast, dark mode, hover and focus states; the landing-page items in §4 |
| `design:accessibility-review` | A WCAG 2.1 AA audit | Before a launch, or after colour and focus changes | **Recommended next**: run it on the signed-in workspace |
| `design:ux-copy` | Microcopy, error messages, empty states, CTA naming | Rewriting run-failure messages and empty states | Recommended for §4 items 4–5 |
| `design:design-system` | Auditing and documenting tokens and components | Before the component count grows further | Recommended: document the tokens added here |
| `dataviz` | Rules for chart form, colour and stat tiles | Any score, chart or KPI tile | Recommended for the dashboard stats and score bars |
| `design:user-research`, `design:research-synthesis` | Interview plans and synthesis | Checking that the changes help real founders | Recommended after the beta cohort |
| `run` | Launches the app and screenshots it | Every UI change | Before/after screenshots |

A catalogue search found no further UI/UX skills to add. The Figma connector is also available: `html_to_figma` can send the screens to a Figma file if a designer wants to iterate there.

---

## 2. Critique: findings before this change

### First impression (2 seconds)

The product reads as competent and trustworthy, but it all looks the same. In the opportunity list, every card is text in identical weights. The score, the one number founders compare, was 20px inline text inside a sentence ("87/100 Demo score"). It did not stand out.

### Findings

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| U1 | **The score is not the visual anchor.** Cards are scanned to compare hypotheses, but the score was styled like body text, so comparing four cards meant reading four sentences. | 🔴 | `components/opportunity-card.tsx` (old) |
| U2 | **Cards are not scannable.** Buyer, price, risk and (live) next step were stacked as four equal label/value pairs. The key risk, the most decision-relevant field, looked the same as the others. | 🟡 | Same |
| U3 | **Small click target.** Only the title and a small "Read report" link were clickable, and the card offered no affordance that it opens. | 🟡 | Same |
| U4 | **Repeated disclaimers.** "Demo score" and "Demo assessment" on every card, *plus* the header badge, page notice, "Demonstration report" badge and footer note. REVIEW.md §6.3 item 3 also flags this. | 🟡 | Dashboard, results |
| U5 | **Dashboard filler.** A promotional banner ("Big ideas deserve a closer look") repeated the "New research" CTA that already sits right above it in the page header (a third copy is in the sidebar). It pushed the stats and opportunities below the fold. | 🟡 | `components/dashboard.tsx` |
| U6 | **The mobile header took two rows** (≈126px of an 844px screen), because the language switcher, demo badge, help and avatar wrapped. | 🟡 | `components/app-shell.tsx` |
| U7 | **No dark mode**, although every colour was already a token. REVIEW.md §6.3 item 5. | 🟡 | `app/globals.css` |
| A1 | **Success text failed WCAG AA:** `#1f8f65` on white is **4.06:1** (needs 4.5:1). Used in the "research enabled" badges. | 🔴 | `--success` |
| A2 | **The warm accent failed non-text contrast:** `#d98a1a` on white is **2.76:1** (icons need 3:1). | 🟡 | `--warm` |
| A3 | **The confidence badge used a decorative dot** carrying no information, while the level itself (higher/medium/lower) had no visual encoding. | 🟢 | `components/shared.tsx` |
| C1 | `primary-foreground` aliased `--card`. It worked by accident in light mode, but any background change would put dark text on blue buttons. | 🟢 | `app/globals.css` |

### What already worked (kept)

- Honest copy and evidence rules, with no fake social proof. This is the brand's strongest asset.
- Token-driven colour. Dark mode was a palette swap, not a rewrite.
- 44px touch targets, skip link, focus management in dialogs, reduced-motion support.
- Clear IA: Overview → My research → results → opportunity detail with tabs.

---

## 3. What this change does

| Area | Change | Fixes |
| --- | --- | --- |
| **ScoreRing** (`components/shared.tsx`) | A ring gauge whose fill is the score, with the number inside. 60px on cards, 96px in the detail sidebars (demo and live). Its accessible name is "Demo score: 87 out of 100" (or "Research score: …"). The SVG is `aria-hidden`. | U1 |
| **Opportunity card** (`components/opportunity-card.tsx`) | Recomposed into this order: score and title → 3-line description → buyer and price in two columns → **key risk in a warm callout with an alert icon** → (live) next validation step → footer with confidence, source count and "Read report". | U2 |
| | The **whole card is one click target** (a `.stretched-link` over the card). The save button sits above it (`relative z-10`). The card draws the keyboard focus ring with `has-[a:focus-visible]`. | U3 |
| | Removed the per-card "Demo score" and "Demo assessment" labels. The demo status is still in the header badge, the page notice and every score's accessible name. | U4 |
| **Confidence** | The decorative dot is now 1–3 signal bars that encode the level; the text label is unchanged. | A3 |
| **Dashboard (demo)** | Removed the promotional banner that duplicated the CTA. Stats and the first two opportunities now fit in the first desktop viewport. | U5 |
| **App header** | Single row on phones: `min-h-16`, no wrapping, the title truncates, and the demo/private badge is hidden below `sm` (the sidebar and page notices carry it). | U6 |
| **Dark mode** (`app/globals.css`) | A full dark palette under `prefers-color-scheme: dark`, with `color-scheme` set so native selects and scrollbars follow it. Added `--primary-foreground`, `--destructive-foreground`, `--score-track` and `--shadow-primary`. Gradient surfaces that carry white text (`.brand-gradient`, `.band-dark`, `.step-number`) are pinned to fixed brand blues. Fixed the landing CTA, which would have shown near-white text on white in dark mode. The theme colour is set for both schemes. | U7, C1 |
| **Contrast** | `--success` `#177a55` (5.31:1 on white, 4.75:1 on its soft fill). `--warm` `#b86e0e` (3.98:1 on white). | A1, A2 |

### Contrast table (WCAG 2.1)

> These are the first pass's blue-palette values. The merged teal palette is in §4.1; its text pairs are at least 4.84:1 in light mode and 6.4:1 in dark mode.

| Pair | Light | Dark |
| --- | --- | --- |
| Body text on background | 14.93 : 1 | 15.48 : 1 |
| Muted text on background | 5.04 : 1 | 7.47 : 1 |
| Muted text on card | 5.41 : 1 | 6.81 : 1 |
| Primary (links) on card | 6.23 : 1 | 6.21 : 1 |
| Primary button label | 6.23 : 1 (white on `#2f55d4`) | 6.74 : 1 (`#0b1430` on `#7c98ff`) |
| Success text | 5.31 : 1 | 8.01 : 1 |
| Warm icon | 3.98 : 1 | 8.27 : 1 |

### Verified

- `pnpm typecheck`, `pnpm test` (112/112) and `pnpm build` all pass.
- No horizontal overflow at 390px on any route checked.
- In Playwright: clicking a card's description opens the report; the save button toggles without navigating (`aria-pressed` updates); keyboard focus draws one ring around the card.

### Known trade-off

Text inside a card cannot be selected with the mouse, because the stretched link covers it. This is the usual cost of whole-card links. The full text is selectable on the report page.

---

## 4. Follow-ups completed (second pass)

The top three items of the original backlog, done on the same branch after merging `codex/ui-ux-redesign` (teal direction, see [`UI_DESIGN.md`](./UI_DESIGN.md)).

### 4.1 Merge and palette reconciliation

The codex branch replaced the blue palette with teal. Its light values were kept, with two contrast corrections, and given a dark counterpart:

| Token / surface | Change | Why |
| --- | --- | --- |
| `--primary` (light) | `#087e83` → `#07787d` | Primary text on the `#f3f6f7` canvas was 4.47:1; now 4.84:1 |
| `.brand-gradient` end | `#40a7a5` → `#23807f` | White CTA text over the light end was 2.88:1; now 4.70:1 |
| Dark palette | Teal-tinted canvas `#0b171c`, card `#11232b`, primary `#4fc4c4` | Every text pair is at least 6.4:1 |
| `.hero-bg` | Fixed `#f0f6f5` → derived from tokens | Would have shown a light hero behind light text in dark mode |
| `.workspace-sidebar` | Defines its own `--primary-foreground` | Its mint "New research" button would otherwise get white text (now 9.76:1) |
| Header | Codex sticky translucent header + single-row mobile sizing | Both changes kept |
| Dark band accent | `#9fb7ff` (old blue) → `#8bdfd6` (mint) | One accent colour per page |

### 4.2 Landing preview (was item 1)

The codex `EvidencePreview` already replaced the `<div>`-built mockup with real demo data and a link into the demo. It now uses the workspace's own `ScoreRing`, `Confidence`, key-risk callout and a new shared `ScoreBreakdown`. It shows the opportunity's real key risk and price unit, and it cannot drift from the product.

This is better than the screenshot originally proposed: a static image goes stale and cannot follow the interface language or colour scheme.

### 4.3 Accessibility audit (was item 2)

**Method:**
- axe-core 4.10 (WCAG 2.0/2.1/2.2 A and AA, plus best practice) on 16 routes, including every report tab and the compare view, in light and dark at 1440px and 390px. That is 64 page contexts.
- Scripted keyboard checks of dialogs, the mobile drawer, report tabs and the skip link.
- Form-error checks.
- Reflow at 320px and at 640px (200% zoom).

| # | Finding | WCAG | Severity | Fix |
| --- | --- | --- | --- | --- |
| A4 | Submitting the new-research and onboarding forms empty showed the browser's untranslated tooltip. The app's inline error (`aria-invalid`, linked message) never ran, because native `required` validation blocked the submit first. | 3.3.1, 3.3.2 | 🔴 | `noValidate` on both forms. `required` is kept for semantics; the inline error now appears, is announced and receives focus. |
| A5 | Checkboxes were 16–20px. | 2.5.8 | 🟡 | 24×24px everywhere (validation lists, report filter, admin). |
| A6 | The desktop sidebar `<aside>` had no name, so pages with their own `<aside>` had two indistinguishable complementary landmarks. | 1.3.1 (best practice) | 🟢 | `aria-label="Workspace"`. |
| A7 | Dimension score lists put a `<div>` bar beside `<dt>`/`<dd>`, which is invalid `<dl>` content. | 1.3.1 | 🟢 | Shared `ScoreBreakdown` puts the bar inside `<dd>`. |
| A8 | Comparison-table rows had no row header. | 1.3.1 | 🟢 | The opportunity cell is `<th scope="row">`. |

**Result:** axe reports **0 violations in all 64 contexts**.

**Behaviour that passed as-is:**
- The help dialog and mobile drawer move focus in, trap Tab, close on Escape and return focus to their trigger.
- Report tabs follow the ARIA tabs pattern: roving `tabIndex`, arrow keys, Home and End.
- A skip link is the first Tab stop on both shells, and every Tab stop shows a visible focus indicator.
- There is no horizontal scroll at 320px or 640px.

**Not covered:** a real screen reader (VoiceOver or NVDA) and the signed-in live screens. The run-progress live region in particular needs a real account and a running job.

### 4.4 Demo disclaimers (was item 3)

| Page | Before | After |
| --- | --- | --- |
| Results | Header badge, "Demonstration report" badge, notice sentence, "How to interpret" details, "Demo confidence" filter, "Demo score" column | Header badge, notice sentence, "How to interpret" details; the filter and column read "Confidence" and "Score" |
| Report | Header badge, notice sentence, "Demo assessment" fact, "Demo" badge on the score panel | Header badge and notice sentence; the fact reads "Score" |

The notes that mark individual sources and buyer hypotheses as synthetic were kept on purpose. On an evidence product, they say exactly which claims are invented. Accessible names still say "Demo score".

## 5. Follow-ups completed (third pass)

Items 4–6 of the backlog.

### 5.1 Research run page (was item 4)

| Change | Detail |
| --- | --- |
| Per-hypothesis progress | `GET /api/research/[id]` now returns `candidates` for runs without a report: each hypothesis from discovery, with `state` (`searching`, `done`, `skipped`) and a source count. It reads only candidate keys and titles (`output->candidates`) and evidence `candidate_id`s, so the 3-second poll stays small. A failed read leaves the stage list unchanged instead of failing the status call. |
| Hypothesis list | The run page lists each hypothesis with "Searching…" (only the first unfinished one, since retrieval is sequential), "Waiting", "N sources", "No usable sources" or "Not searched" (for a stopped run). A line under the heading explains that hypotheses without usable sources are dropped, not filled in. |
| Technical details | Estimated cost, committed budget, tokens, search requests and the hosting note move under a collapsed "Technical details" section. It opens by default only when a run stopped on its budget, because that is when the numbers matter. The completed-run summary shows the candidate count instead of a four-decimal dollar figure. |
| Tests | `candidateProgress` (pure helper in `lib/report-presentation.ts`) has two unit tests. A render test covers the hypothesis list and checks that technical details are collapsed while a run is healthy and open after a budget stop. |

This could only be checked with a fixture (a temporary route that was not committed). A real running job needs Supabase and provider credentials.

### 5.2 Empty states (was item 5)

A shared `EmptyState` replaces four different patterns. Each shows a context icon, what is missing and why, and one next step. Its text is a status region, so a filter that empties the list is announced.

| Where | Before | After |
| --- | --- | --- |
| My research, no briefs (live) | Empty table with its header row, a status line inside, and a detached button below | One empty state: "No research yet", a sentence on what a run does, "New research", and a link to the demo report. The header "New research" button hides so the action is not offered twice. |
| My research, search with no match | Same empty table | The search stays and the table is replaced by "No matching research" with "Clear search" |
| Saved (demo) | Centred card with a different layout | Same component (Bookmark icon); "Clear filters" when a filter emptied the list |
| Saved and results (live) | Generic telescope icon for every case; the results description came from a Chinese source string | Bookmark, FileSearch or SearchX for each case; English-source description |

The library search also showed two "×" controls (the browser's plus the app's); the browser's is now hidden on that input.

### 5.3 Landing page (was item 6)

- **Labels:** two remain, the hero positioning line and "Honest by design" on the rules band. The "What you get", "How it works", "Who it's for" and "Questions" labels repeated their headings. Section `id`s and nav anchors are unchanged.
- **Hero pill:** the decorative dot and the unused `.demo-dot` rule are gone.
- **Dark band:** the landing rules band and sign-in panel sit on deep ink `#0f2a33` instead of the old navy `#0f1d3f`, matching the teal palette (white text 15:1).

### Verified

- `pnpm typecheck` passes, `pnpm test` passes 115/115, and `pnpm build` passes.
- axe still reports 0 violations across the 64 page contexts.
- The demo empty states were checked in light and dark: "Clear search" restores the rows and the table hides on no match.

## 6. Still recommended (prioritised)

| # | Recommendation | Why | Effort | Skill |
| --- | --- | --- | --- | --- |
| 7 | **Stat tiles on mobile** take a full screen. Use a compact 2×2 without detail lines below `sm`, or a horizontal strip. | Pushes opportunities below the fold on phones. | S | `dataviz` |
| 8 | **Manual theme toggle** (system / light / dark) in the header menu, stored per viewer. | Dark mode follows the OS only. Some users want to override it. | S | n/a |
| 9 | **Em and en dashes in copy** (7 in `messages/en.json`, more in Chinese where they are idiomatic). | Optional. Some style guides now treat em dashes as a sign of AI-written text; plain punctuation reads more direct. Do not change the Chinese catalogues. | S | `design:ux-copy` |
| 10 | **Document the design tokens** (colour, radius, shadow, and the ScoreRing, Confidence, ScoreBreakdown and EmptyState primitives) as a short design-system page. | Prevents hard-coded colours from creeping back in and breaking dark mode. | S | `design:design-system` |

---

## 7. How to keep the UI from regressing

1. **Use tokens, never hex values, in components.** `grep -rnE "#[0-9a-f]{3,6}|bg-white|text-black" components` should return only the fixed-brand surfaces documented in `app/globals.css`.
2. **Check both schemes.** In Chrome DevTools → Rendering → "Emulate CSS prefers-color-scheme", or with Playwright: `browser.newContext({ colorScheme: "dark" })`.
3. **Check contrast** for any new text/background pair. Target 4.5:1 for text and 3:1 for icons and large text.
4. **Screenshot at 390px** after any header or card change, and look for wrapped rows and horizontal overflow.
5. **Run `design:design-critique`** on a new screen before merging it, and paste its priority list into the PR.
