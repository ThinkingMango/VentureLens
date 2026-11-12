# VentureLens interface direction

## Premium analyst workspace

The interface helps founders compare opportunities, inspect evidence, and decide what to validate. Its visual language follows research software: compact panels, aligned values, restrained color, and persistent navigation. The public preview uses the actual synthetic fixtures and lets visitors select a hypothesis before opening its report.

- Charcoal canvas `#101318`, raised panels `#181d25`, pale text `#e4e8ef`, secondary text `#9aa6b8`, and blue actions `#94b5ff`.
- Geist with the existing CJK fallback stack. Use tabular numerals for comparable scores and compact, medium-weight headings. Small corner radii distinguish controls and panels without making every item a floating card.
- Replace the demo dashboard's promotional banner with a summary strip and a shared opportunity card grid. Account-backed overviews use the same card component; save actions retain the existing workspace provider behavior.
- Keep synthetic reports visibly labeled. Scores are comparative scenarios, never verified demand or success probabilities.

## Mobile behavior

- At phone widths, opportunity cards stack vertically with title, buyer, score, save, and full-width report actions visible. Pricing, risks, validation, and confidence expand on demand. Overviews show two opportunities with a link to the full results.
- Research history uses linked cards on phones and a table on desktop. Search matches title and localized industry, trims whitespace, and includes an inline clear action.
- The workspace header keeps navigation, page context, and the language picker visible; secondary header controls move out of the narrow layout. Help remains accessible in the drawer.
- Primary landing actions span the available phone width. The sample report expands on demand. No page-level horizontal scrolling is intended at 320px and above.
- Statistics, activity, setup checklists, founder context, and results filters expand on demand on phones. Desktop supporting content stays visible. Filter selections persist when collapsed.
- Profile setup shows one step heading and progress indicator on phones. Skill examples and the final recap expand on demand; required inputs remain visible.
- Maintain 44px primary controls, visible keyboard focus, drawer focus restoration, reduced-motion support, and all three interface languages.

## Guidance and references

- [Frontend Design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): intentional visual hierarchy, subject-specific design, restrained decoration, and screenshot critique.
- Vercel React Best Practices skill: shared components, derived state, semantic controls, stable keys, and avoiding unnecessary effects.
- [Koyfin](https://www.koyfin.com/): researched as a reference for customizable analyst dashboards and keeping research data together. VentureLens retains its own components and founder-research workflow.

Product Design was installed during the session, but no Product Design skills or callable tools appeared in the available catalogs. This implementation does not claim to use that plugin.

## Review checklist

- Landing preview selection updates the matching title, buyer, score breakdown, risk, and report link.
- Demo and account-backed overview save actions use existing persistence behavior.
- Research title/sector search, whitespace handling, no-match state, and clear recovery.
- Drawer dismissal and focus restoration, nested active navigation, and public skip links.
- English, Simplified Chinese, and Traditional Chinese on phone and desktop widths.
- Account-backed research requires configured Supabase and provider credentials; demo validation does not verify those integrations.

## Card presentation

Overview, results, and saved opportunities use the shared OpportunityCard component. Cards stack on phones and form two columns on wider screens, with score, title, description, buyer, pricing assumptions, risk, confidence, and a full-width mobile report action. Save remains an independent accessible toggle. Landing preview choices are also presented as selectable cards. The results comparison view remains optional.

## Landing page (November 2026 redesign)

The landing page spends its boldness in one place, the **run ledger**, and keeps everything else quiet: type, whitespace and hairline rules instead of card grids.

- **Hero:** one full-width Newsreader headline (optical-size axis enabled in `app/layout.tsx`), then the copy and calls to action beside the interactive `EvidencePreview`. No eyebrow, no accented phrase.
- **How it works:** three numbered steps, because they are a real sequence: profile, research run (find or check), validation sprint.
- **Run ledger** (`#research-run`): an illustrative run of eight hypotheses against the four gates the engine applies in order (evidence found, two independent websites, non-vendor buyer demand, adversarial review). The four survivors are the demo opportunities and link to their demo pages; the four dropped ideas are struck through with the reason given. From 1024px it is a grid with one column per gate; on phones each row shows a four-segment track and a plain-language status. Scrolling draws the strike-through (`animation-timeline: view()`); browsers without scroll timelines, and reduced-motion users, see it drawn.
- **Rules:** stated beside the ledger with numbers read from code where they can drift (`REVIEW_MAX_PENALTY`). The evidence caps (70 / 85) match `scoreParts` in `lib/research-core.ts`; the demo's top score is 84 so the page never shows a score above the cap it advertises.
- **Report contents, audiences, FAQ, closing:** definition list, prose columns, a hairline `details` list, and a closing statement on the card surface. No green call-to-action box.
- **Phones:** below 640px the hero preview and the ledger run edge to edge (no side border, radius or shadow) instead of nesting card padding inside the 20px page gutter, which gives their text about 40px more width; their own content keeps the 20px inset. Ledger rows split the status into a muted gate label and the reason, survivor links have 44px tap targets, and the preview's three score values share a baseline when a label wraps. Audited at 320, 360, 375, 393 and 412px.
- `--warm-ink` (#8a5a1f) is the ochre used for text (dropped reasons); `--warm` stays decorative.
- Chinese display headings use `word-break: keep-all` so they break at punctuation, not mid-word.
- Custom layout classes set `display` only inside media queries where a Tailwind visibility utility (`hidden`, `lg:grid`) shares the element, because unlayered CSS outranks Tailwind v4's layered utilities.

## Pricing page (November 2026 redesign)

Built the same way as the landing page: one Newsreader headline, quiet hairline sections, and one structured element that carries the page's real argument.

- **Hero:** leads with what is true today, "Your first research run is free", and says plainly that paid credits are planned but not on sale, so nothing on the page can charge anyone.
- **Planned packages** (`PlanTable`): one comparison instead of three feature cards. Nothing is gated by package, so the table shows only what differs: price, runs, and the price per run (derived from `price / runs`, never typed). There is no "most popular" badge and no buy button, because nothing can be bought. Phones show each package's three figures side by side, and CSS subgrid keeps the values on one line when a label wraps. `/demo/billing` reuses it with `bleed={false}` so it stays a card inside the workspace.
- **Example credit statement:** walks through the refund rule in `release_failed_research_run`. Failures on our side (here, a provider outage) always return the credit; thin evidence returns it up to a per-account limit, stated without publishing the number. Stopped runs use the ochre `--warm-ink` as on the landing ledger; returned credits use the primary green.
- FAQ and closing band match the landing. The stale "authorized development accounts" answer is gone.
- `.plan-row` and `.statement-row` set columns only, never `display`, so a Tailwind `hidden md:grid` header keeps working.

## Landing and pricing quick wins (review follow-up)

- **Phones keep a call to action in reach.** `MobileCtaBar` in `PublicShell` slides up "Get started" and "Try the demo" once the page's own buttons (`data-cta-start`) scroll away, and hides again when the closing band (`data-cta-end`) arrives. Pages without the markers never show it; it is `inert` while hidden, and display comes from Tailwind (`flex lg:hidden`) only. The phone menu's "Get started" is a button, not a text link.
- **"Live demo" is now "Demo" / "Try the demo"**, because the demo is synthetic.
- **The hero states run time** with the figure the run page shows: a full run usually takes 5–10 minutes.
- **On phones the hero preview is a short list of links** into the demo (no detail panel), so the run ledger starts about 500px sooner.
- **The ledger leads with its conclusion** ("8 ideas proposed. 4 dropped. 4 in the report."); the footer keeps the synthetic-data note.
- **Menu order follows the page:** How it works, What you get, Demo, Pricing, FAQ.
- **Link previews:** `app/opengraph-image.png` (1200×630, rendered in the brand fonts) with alt text, Open Graph and Twitter tags, and `metadataBase` from the same `siteOrigin()` the notification emails use. The meta description is rewritten in all three languages.
