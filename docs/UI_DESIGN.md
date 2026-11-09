# VentureLens interface direction

## Premium analyst workspace

The interface helps founders compare opportunities, inspect evidence, and decide what to validate. Its visual language follows research software: compact panels, aligned values, restrained color, and persistent navigation. The public preview uses the actual synthetic fixtures and lets visitors select a hypothesis before opening its report.

- Charcoal canvas `#101318`, raised panels `#181d25`, pale text `#e4e8ef`, secondary text `#9aa6b8`, and blue actions `#94b5ff`.
- Geist with the existing CJK fallback stack. Use tabular numerals for comparable scores and compact, medium-weight headings. Small corner radii distinguish controls and panels without making every item a floating card.
- Replace the demo dashboard's promotional banner with a summary strip and a shared opportunity card grid. Account-backed overviews use the same card component; save actions retain the existing workspace provider behavior.
- Keep synthetic reports visibly labeled. Scores are comparative scenarios, never verified demand or success probabilities.

## Mobile behavior

- At phone widths, opportunity cards stack vertically and retain buyer, pricing, risk, score, and save action. Report buttons span the card width.
- Research history uses linked cards on phones and a table on desktop. Search matches title and localized industry, trims whitespace, and includes an inline clear action.
- The workspace header keeps navigation, page context, and the language picker visible; secondary header controls move out of the narrow layout. Help remains accessible in the drawer.
- Primary landing actions span the available phone width. Preview selection buttons stack, and the evidence detail follows the selection list. No page-level horizontal scrolling is intended at 320px and above.
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
