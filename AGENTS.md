<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design system

The existing VentureLens design takes precedence over the visual rules (Part B) of the `landing-page-design` skill in `.claude/skills/`, which says it applies to all web UI. Keep:

- Newsreader display headings with Geist for text (`app/layout.tsx`, `.font-display`, `.landing-title`)
- lucide-react icons
- The motion tokens in `app/globals.css` (`--ease-out`, `--ease-in-out`, `--ease-drawer`): 150–250ms for UI, exits faster than entrances, hover lifts only with a fine pointer
- The current spacing, radii and colour tokens, and the wording of translated copy, dashes included

Use the skill's Part A (strategy, page structure, conversion copy, SEO) freely. Its content rules still apply everywhere: never invent prices, statistics or testimonials.
