# VentureLens editorial mobile redesign

## Intent

Replace VentureLens's dark, terminal-like interface with a coherent editorial research experience across the public site and product. Make the research journey easier to understand and use on phones, and present research output primarily as useful, scannable cards rather than dense panels or hidden disclosure content.

The product's evidence-first positioning remains the differentiator. The redesign should feel like a well-edited research journal: calm, credible, precise, and easy to act on.

## Goals

- Create a new visual identity using warm paper-like surfaces, deep green ink, and one restrained amber accent; do not preserve the existing dark theme.
- Cover the landing page, public supporting pages, authentication, onboarding, workspace shell, dashboard, research configuration and history, results, saved opportunities, opportunity detail, billing, and shared states.
- Make opportunity cards the primary output format in both demo and live reports.
- Keep essential buyer, evidence, pricing, risk, and validation information visible on mobile; use progressive disclosure only for genuinely secondary detail.
- Provide clear navigation, one obvious primary action per view, responsive forms, readable long-form reports, and useful empty/error/progress states.
- Preserve English, Simplified Chinese, Traditional Chinese, synthetic demo labeling, source caveats, authentication, saving, filtering, sorting, export, research progress, and all server behavior.
- Meet keyboard and touch accessibility expectations: visible focus, semantic structure, at least 44px touch targets, sufficient contrast, reduced-motion support, and no horizontal page overflow.

## Non-goals and anti-goals

- Do not change the research engine, APIs, database schema, provider settings, entitlement rules, pricing behavior, or fixture data.
- Do not migrate away from Next.js 16, React 19, Tailwind CSS 4, next-intl, or existing UI primitives.
- Do not add a theme toggle or retain the previous palette as an alternate theme.
- Do not add payments, integrations, new product features, or marketing claims.
- Avoid generic AI gradients, glass effects, decorative animation, dense dashboard chrome, and card grids whose content requires excessive tapping to understand.

## Constraints

- Work within the existing component structure and dependency set. Use existing Lucide icons consistently rather than adding an icon package.
- Follow `AGENTS.md`: consult the installed Next.js 16 documentation before implementation.
- All new user-facing copy must go through `copy()` and be added to all three locale catalogs using the repository's i18n workflow.
- Demo data must remain separate from real account data and clearly labeled synthetic.
- Live and demo views may differ in data availability, but their layout and interaction language must remain consistent.
- No new runtime dependency is needed. Fonts may use `next/font/google`; provide robust CJK fallbacks.

## Approaches considered

1. **Editorial research journal — selected.** Warm off-white background, white/paper cards, deep green text, amber highlights, serif display headings paired with a highly legible sans-serif body. Best supports long-form evidence and a trustworthy founder research product.
2. **Precision instrument.** Cool neutrals and cobalt with a compact data-tool layout. Efficient, but less approachable and less distinct from generic analytics products.
3. **Modern dark studio.** A new charcoal/mint dark palette. Retains a dark working environment, but is less comfortable for lengthy reports and does not create as clear a break from the current experience.

The user selected the editorial research journal for a whole-product redesign.

## Design system

### Color and surfaces

- Page background: warm ivory, approximately `#F5F3ED`.
- Primary card surface: soft white, approximately `#FFFEF9`; secondary surface: muted sage, approximately `#E9EEE7`.
- Primary text: deep green-black, approximately `#17352D`; secondary text: desaturated green-gray with accessible contrast.
- Primary action and active state: deep forest green, approximately `#245846`, with light foreground text.
- Accent: muted amber, approximately `#C4863C`, used sparingly for scores, highlights, and risk markers—not body text on light surfaces.
- Destructive and success states remain distinguishable by icon/text as well as color.
- Cards use 1px low-contrast warm borders, generous spacing, 16–20px outer radii, and very subtle tinted shadows only for floating layers. Do not put every text group inside another bordered box.

### Typography

- Use a characterful serif such as Newsreader for marketing display headings and major report titles; use Geist for controls, body copy, labels, and data. Preserve Noto Sans SC and CJK fallbacks.
- Display headings use tight tracking and balanced wrapping; body copy stays near 65 characters per line with relaxed line height.
- Use sentence case, small editorial labels rather than pervasive uppercase, and tabular numerals for scores, prices, usage, and metrics.
- Mobile body and input text remain at least 16px where needed to prevent iOS zoom; secondary text remains legible rather than miniaturized.

### Shared components and states

- Restyle buttons, inputs, selects, badges, dialogs, progress, charts, and cards through existing primitives and global tokens before adjusting individual screens.
- Buttons have clear hover, pressed, disabled, loading, and focus states. Primary actions span the available width on narrow screens where that improves reach and clarity.
- Forms use persistent labels, concise helper text, inline validation, and a single clear submission action. Errors remain inline and do not rely on toast messages alone.
- Empty states explain the next useful action. Loading and progress states preserve the page structure. Long content wraps safely, including URLs, CJK text, and translated labels.

## Information architecture and UX

### Public site

- Replace the terminal masthead and dark bands with an asymmetrical editorial hero: direct value proposition, concise supporting copy, primary demo CTA, secondary account CTA, and a visible sample opportunity card.
- Reduce repeated marketing sections. Organize the page around: value proposition and sample output; three-step research journey; report contents; evidence rules; intended users; FAQ; final CTA.
- Use cards for sample output and report capabilities, but vary layout with editorial spacing rather than producing identical three-column rows everywhere.
- Simplify public mobile navigation into an accessible menu with large targets and clear login/get-started actions. Apply the new system to pricing, support, privacy, and not-found pages through the shared shell and primitives.

### Authentication and onboarding

- Keep the existing email-code behavior and four-step founder profile flow.
- Use a focused single-column form on phones and a calm brand/context panel only where space permits on desktop.
- Make step progress visible and readable on mobile. Keep Back and Continue actions in consistent positions, with the primary action easy to reach.
- Convert option groups to large selectable cards where choices benefit from comparison; preserve native controls and validation.

### Workspace shell and navigation

- Replace the dark fixed-sidebar aesthetic with the editorial system. Desktop retains an efficient sidebar because it serves repeated workspace navigation; mobile uses a compact top bar plus an accessible navigation drawer.
- Add a mobile bottom navigation for the four highest-frequency destinations: Overview, Research, Saved, and Profile. Keep New research prominent in the header/dashboard and ensure footer/legal links remain reachable without crowding the bottom bar.
- Add safe-area padding and enough bottom content spacing so the mobile navigation never covers actions or report content.
- Show current location clearly, preserve language switching and help, and avoid hiding essential account state behind ambiguous icons.

### Dashboard and research library

- Lead with a welcome/action block and a small set of metric cards, then opportunity cards, recent research, and validation guidance.
- Keep all metric cards visible in a responsive two-column phone grid; do not place basic statistics behind a disclosure.
- Present research history as cards on phones and an optional structured table on wide screens. Status, date, opportunity count, and open action should be immediately scannable.

### Research setup and progress

- Group the brief into named cards: research focus, discovery preferences, constraints, and review/submit. On mobile these stack in a logical single column with no nested essential disclosures.
- Keep the research pipeline explanation secondary to the form, but show a compact summary of what the run produces near submission.
- Research progress becomes a status card with current stage, plain-language explanation, and a vertical step timeline on phones. Cost and model metadata remain available in execution details.

## Card-based research output

### Opportunity cards

Each result card must communicate, in order:

1. Rank or category, score out of 100, confidence, and an accessible save control.
2. Opportunity title and concise description.
3. Likely buyer and business/pricing hypothesis.
4. Evidence count for live reports or a clear synthetic assessment label for demo reports.
5. Key risk to validate, visually emphasized without overwhelming the card.
6. A clear Read report action; the title remains linked as well.

Use a single-column card list on phones, two columns when content fits, and avoid hiding pricing/risk/confidence behind `MobileDisclosure`. Keep card actions aligned while allowing content height to vary naturally. Saved, pressed, focus, empty, and busy states remain visible.

### Results and reports

- Start with a report summary card containing completion state, concise summary, opportunity/source counts, generated date, and report-language note.
- Put search, confidence filtering, and sorting in a compact filter card. Keep search visible; filters may collapse on phones only when their active state and modified count are obvious.
- Default to cards. Retain comparison as an opt-in horizontally scrollable region with accessible labeling, never as the mobile default.
- Preserve export and new-research actions without competing with the main result list.
- Use the same `OpportunityCard` for dashboard, demo results, live report shortlist, and saved views.

### Opportunity detail

- Lead with a title/summary card and visible score, buyer, pricing, confidence, and save action.
- Keep Overview, Evidence, Economics, and Validation tabs with existing keyboard behavior; make them horizontally scrollable on small screens with clear selected state.
- Render tab content as a sequence of readable sections/cards. Evidence sources become individual cards with type, verification status, observation, interpretation, source link/limitations, and retrieval context where available.
- Place score breakdown after the main content on phones and in a sticky supporting column only on wide screens. Validation checklist rows remain large, readable cards with persistent progress.

## Verification

- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` on the final project.
- Exercise the synthetic demo end to end in the browser: landing → dashboard → research setup → results → save/filter/sort/compare → opportunity tabs/validation → profile.
- Check public navigation, login/signup presentation, pricing, support/privacy, empty states, and research progress/report presentation where fixtures permit.
- Inspect at minimum 320px, 390px, 768px, and 1440px widths. Confirm no page-level horizontal overflow, obscured controls, hidden essential output, or unreadable CJK text.
- Verify keyboard focus, mobile menu/drawer behavior, tab keyboard controls, save toggles, filter empty state, export action, and reduced-motion behavior.
- Review the final diff for unintended backend changes and missing i18n entries.

## Builder discretion

The builder may tune exact spacing, responsive breakpoints, card composition, and icon choice within this system; consolidate duplicate layouts where doing so reduces drift; and make small copy edits for clarity without changing product claims. Any new copy still requires all locale entries. No additional product scope or dependencies should be introduced.
