# VentureLens interface direction

The primary job is to help a founder move from a question to evidence and then a validation decision. Show the report before asking visitors to commit to an account; keep research navigation stable once they enter the workspace.

## Design system

- Ink `#182f3c` for content, deep ink `#122e3a` for workspace navigation, teal `#087e83` for actions, mist `#f3f6f7` for the canvas, and white for reading surfaces.
- Geist for headings and controls, with the existing CJK font stack. Use large, left-aligned landing typography; keep report body text compact and readable.
- A two-column landing introduction pairs the product promise with a working link to a clearly labeled synthetic report. Stack it on smaller screens.
- Keep the sidebar visually separate from research content. Active navigation uses both a tinted background and an inset marker, with matching `aria-current` semantics.
- Use a table for desktop research comparison and linked cards on phones. Search title and localized industry, trim whitespace, and provide a clear recovery action.
- Keep motion restrained, visible keyboard focus, 44px controls, and the existing reduced-motion support. Preserve synthetic-data labels and all three interface languages.

## Guidance consulted

[Anthropic Frontend Design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): subject-specific visual direction, deliberate typography, responsive layouts, and screenshot critique. Applied as design guidance; no third-party runtime code or package was added.

The optional Product Design plugin was discovered but was not connected or used. The existing app implementation remains the source of truth for behavior.

## Review checklist

- Landing: report preview links, demo entry, signup entry, FAQ, mobile navigation, and skip link.
- Workspace: active research navigation on nested routes, mobile drawer dismissal and focus restoration.
- Library: title and sector search, whitespace handling, no-match state, clear search, mobile cards, desktop table.
- Layout: English, Simplified Chinese, Traditional Chinese at phone and desktop widths.
- Account-backed research requires configured Supabase and provider credentials; demo validation does not verify those integrations.
