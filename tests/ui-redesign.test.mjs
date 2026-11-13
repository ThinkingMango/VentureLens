import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the editorial theme replaces the dark terminal palette", () => {
  const css = read("app/globals.css");
  const layout = read("app/layout.tsx");
  assert.match(css, /--background:\s*#f5f3ed/i);
  assert.match(css, /--foreground:\s*#17352d/i);
  assert.match(css, /--primary:\s*#245846/i);
  assert.match(css, /--warm:\s*#c4863c/i);
  assert.match(css, /color-scheme:\s*light/);
  assert.doesNotMatch(css, /#101318/i);
  assert.match(layout, /Newsreader/);
  assert.match(layout, /themeColor:\s*"#[fF]5[fF]3[eE][dD]"/);
});

test("shared cards and controls use the editorial interaction system", () => {
  const card = read("components/ui/card.tsx");
  const button = read("components/ui/button.tsx");
  const input = read("components/ui/input.tsx");
  assert.match(card, /rounded-2xl/);
  assert.match(button, /active:scale-\[0\.98\]/);
  assert.match(button, /min-h-11/);
  assert.doesNotMatch(button, /transition-all/);
  assert.match(input, /text-base/);
  assert.match(input, /focus-visible:ring-2/);
});


test("workspace mobile navigation exposes the four primary destinations", () => {
  const shell = read("components/app-shell.tsx");
  assert.match(shell, /mobile-workspace-nav/);
  assert.match(shell, /aria-label=\{copy\("Mobile workspace navigation"\)\}/);
  assert.match(shell, /workspace-main/);
  for (const href of ["/dashboard", "/research", "/saved", "/profile"]) {
    assert.match(shell, new RegExp(`href: "${href}"`));
  }
  assert.match(shell, /safe-area-inset-bottom|mobile-workspace-nav/);
});

test("the public shell uses a readable editorial surface", () => {
  const shell = read("components/public-shell.tsx");
  const brand = read("components/shared.tsx");
  assert.match(shell, /bg-background text-foreground/);
  assert.match(brand, /font-display/);
  assert.doesNotMatch(brand, /rounded-lg bg-primary/);
});


test("opportunity cards keep essential mobile evidence visible", () => {
  const card = read("components/opportunity-card.tsx");
  assert.doesNotMatch(card, /MobileDisclosure/);
  assert.match(card, /Monthly price hypothesis/);
  assert.match(card, /Key risk to validate/);
  assert.match(card, /<Confidence level=\{o\.confidence\} \/>/);
  assert.match(card, /linked source page/);
  assert.match(card, /Read report/);
});

test("research results default to cards and retain accessible comparison", () => {
  // The demo results view lives in its own lazily loaded module; the live view is LiveResearchResults.
  const results = read("components/demo-research-results.tsx");
  assert.match(results, /useState<"cards" \| "compare">\("cards"\)/);
  assert.match(results, /Opportunity comparison; scroll horizontally/);
  assert.match(results, /Clear filters/);
});


test("dashboard metrics stay visible on mobile in demo and live workspaces", () => {
  for (const path of ["components/demo-dashboard.tsx", "components/live-workspace.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /<MobileDisclosure title=\{copy\("Workspace statistics"\)\}>/);
  }
  const dashboard = read("components/demo-dashboard.tsx");
  assert.match(dashboard, /terminal-stats/);
});

test("research history uses card-like mobile rows and a persistent search", () => {
  const library = read("components/research-library.tsx");
  assert.match(library, /grid gap-3 p-3 md:hidden/);
  assert.match(library, /rounded-xl border bg-card/);
  assert.match(library, /type="search"/);
});


test("research setup uses its inline validation instead of native bubbles", () => {
  const config = read("components/research-config.tsx");
  assert.match(config, /<form\s+className="flex flex-col gap-7"\s+noValidate/);
});


test("landing and authentication retire dark bands and mobile report disclosures", () => {
  const landing = read("components/landing.tsx");
  const auth = read("components/auth-screen.tsx");
  assert.doesNotMatch(landing, /band-dark|terminal-masthead|MobileDisclosure/);
  assert.match(landing, /<EvidencePreview \/>/);
  assert.match(landing, /hero-layout/);
  assert.doesNotMatch(auth, /band-dark|muted-on-dark|grid-bg/);
  assert.match(auth, /min-h-dvh/);
});

test("profile choices are large native radio cards", () => {
  const choices = read("components/profile-choice.tsx");
  assert.match(choices, /type="radio"/);
  assert.match(choices, /role="radiogroup"/);
  assert.match(choices, /rounded-xl border/);
  assert.match(choices, /checked=\{selected\}/);
});


test("numeric scores never wrap digit-by-digit", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.terminal-number\s*\{[^}]*white-space:\s*nowrap/s);
});


test("workspace header stays compact on the smallest phones", () => {
  const shell = read("components/app-shell.tsx");
  assert.match(shell, /flex min-h-16 flex-nowrap/);
  assert.match(shell, /min-w-0 truncate font-medium/);
});


test("short mobile navigation labels are localized", () => {
  const key = (value) => {
    let hash = 2166136261;
    for (const character of value.replace(/\s+/g, " ").trim()) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
    return `m${(hash >>> 0).toString(36)}`;
  };
  const hans = JSON.parse(readFileSync(new URL("../messages/zh-Hans.json", import.meta.url), "utf8"));
  const hant = JSON.parse(readFileSync(new URL("../messages/zh-Hant.json", import.meta.url), "utf8"));
  assert.equal(hans.ui[key("Saved")], "已保存");
  assert.equal(hans.ui[key("Profile")], "个人资料");
  assert.equal(hant.ui[key("Saved")], "已收藏");
  assert.equal(hant.ui[key("Profile")], "個人資料");
});


test("research setup is divided into named scannable groups", () => {
  const config = read("components/research-config.tsx");
  for (const label of ["Set your research focus", "Discovery preferences", "Your real-world constraints", "Review and start"]) {
    assert.match(config, new RegExp(`copy\\("${label}"\\)`));
  }
  assert.match(config, /aria-labelledby="research-focus-group"/);
  assert.match(config, /aria-labelledby="research-review-group"/);
});

test("the landing page's claims about scoring match the engine", async () => {
  const landing = read("components/landing.tsx");
  const core = read("lib/research-core.ts");
  // The review penalty is read from code, never typed into the copy.
  assert.match(landing, /REVIEW_MAX_PENALTY/);
  assert.doesNotMatch(landing, /up to \d+ points/);
  // The page advertises an 85 cap, so no demo score shown beside it may exceed the engine's cap.
  assert.match(core, /const cap = evidenceCount >= 3 \? 85 : 70;/);
  assert.match(landing, /tops out at 85/);
  const { opportunities } = await import("../lib/demo-data.ts");
  for (const o of opportunities) assert.ok(o.score <= 85, `${o.id} scores ${o.score}, above the 85 cap`);
  // The ledger's desktop header must stay hidden on phones: its grid display lives only in the 1024px query.
  const css = read("app/globals.css");
  const base = css.slice(0, css.indexOf("@media (min-width: 1024px)"));
  assert.doesNotMatch(base, /\.ledger-head[^{]*\{[^}]*display:/);
});

test("the pricing page states only what the product and the refund rule actually do", () => {
  const pricing = read("components/pricing.tsx");
  const refunds = read("supabase/migrations/20261109150000_cap_failed_run_refunds.sql");
  // Live research is open to every confirmed account, not only "authorized development accounts".
  assert.doesNotMatch(pricing, /Authorized development accounts/);
  // Nothing is gated by package, so the comparison lists no per-package features.
  assert.doesNotMatch(pricing, /Everything in |features:/);
  // The statement's "always returned" entry is a provider outage, which the refund trigger treats as our fault,
  // and thin evidence is returned only within the per-account allowance.
  assert.match(refunds, /'TRANSIENT_PROVIDER'/);
  assert.match(refunds, /runs_refunded < max_refunds/);
  assert.match(pricing, /a search provider was unavailable/);
  assert.match(pricing, /up to a per-account limit/);
  // Per-run prices are derived from price and runs, never typed in.
  assert.match(pricing, /export const perRun = .*=> plan\.price \/ plan\.runs;/);
  assert.doesNotMatch(pricing, /perCredit/);
  // The demo billing page reuses the same comparison, kept as a card inside the workspace.
  assert.match(read("components/billing.tsx"), /<PlanTable bleed=\{false\} \/>/);
});

test("public pages keep a call to action in reach on phones and share with a proper preview", () => {
  const shell = read("components/public-shell.tsx");
  const css = read("app/globals.css");
  // The phone bar takes display from Tailwind only; unlayered CSS would override "lg:hidden" on desktop.
  assert.match(shell, /className="mobile-cta flex gap-3 lg:hidden"/);
  assert.doesNotMatch(css.match(/\.mobile-cta \{[^}]*\}/)[0], /display:/);
  for (const page of ["components/landing.tsx", "components/pricing.tsx"]) {
    const source = read(page);
    assert.match(source, /data-cta-start/, page);
    assert.match(source, /data-cta-end/, page);
    // The demo is synthetic, so it is never called "live".
    assert.doesNotMatch(source, /live demo/i, page);
  }
  assert.doesNotMatch(shell, /"Live demo"/);
  // The menu follows the order of the landing page's sections.
  assert.ok(shell.indexOf('"/#how-it-works"') < shell.indexOf('"/#whats-inside"'));
  // The landing states run time with the same figure the run page shows.
  assert.match(read("components/research-run.tsx"), /A full run usually takes 5–10 minutes\./);
  assert.match(read("components/landing.tsx"), /a full run usually takes 5–10 minutes\./);
  // Link previews: a share image and Open Graph / Twitter metadata.
  assert.ok(readFileSync(new URL("../app/opengraph-image.png", import.meta.url)).length > 10_000);
  const layout = read("app/layout.tsx");
  assert.match(layout, /openGraph:/);
  assert.match(layout, /summary_large_image/);
  const en = JSON.parse(read("messages/en.json"));
  assert.doesNotMatch(en.metadata.description, /manage your opportunity shortlist/);
});

test("every public promise of free runs matches the signup grant: 10 runs for 90 days", () => {
  const grant = read("supabase/migrations/20261111140000_signup_grant_ten_runs.sql");
  assert.match(grant, /now\(\) \+ interval '90 days', 10, 'signup'/);
  for (const file of ["landing", "pricing", "public-shell", "auth-screen", "research-access-card", "support"]) {
    const source = read(`components/${file}.tsx`);
    assert.doesNotMatch(source, /one free research run|one full research run|One research run is granted|first research run is free/i, file);
    assert.match(source, /10 free research runs|10 full research runs|Ten research runs|first 10 research runs/, file);
  }
  for (const page of ["components/pricing.tsx", "components/support.tsx", "components/landing.tsx"])
    if (/valid for/.test(read(page))) assert.match(read(page), /valid for 90 days/, page);
  assert.match(JSON.parse(read("messages/en.json")).metadata.description, /first 10 runs are free/);
});

test("motion uses the shared easing tokens and real animations, not missing plugin classes", () => {
  const css = read("app/globals.css");
  const dialog = read("components/ui/dialog.tsx");
  const shell = read("components/app-shell.tsx");
  for (const token of ["--ease-out", "--ease-in-out", "--ease-drawer"]) assert.match(css, new RegExp(`${token}:\\s*cubic-bezier`));
  // tailwindcss-animate is not installed, so its classes would silently do nothing.
  assert.doesNotMatch(dialog, /animate-in|zoom-in-95|slide-in-from/);
  assert.match(dialog, /dialog-overlay/);
  assert.match(dialog, /dialog-content/);
  assert.match(css, /\.dialog-content\[data-state="closed"\]/);
  assert.match(shell, /dialog-sheet workspace-sidebar/);
  // Hover lifts only with a real pointer, and reduced motion keeps colour feedback.
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.lift:hover/);
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*transition-property: color/);
});

test("the workspace sidebar never squashes its header or footer when it overflows", () => {
  const shell = read("components/app-shell.tsx");
  assert.match(shell, /flex h-16 shrink-0 items-center/);
  assert.match(shell, /flex shrink-0 items-center gap-3 border-t/);
});

test("opportunity cards open from anywhere and keep one quiet call to action", () => {
  const card = read("components/opportunity-card.tsx");
  const css = read("app/globals.css");
  assert.match(card, /card-link group/);
  assert.match(card, /card-link-target/);
  assert.doesNotMatch(card, /<Button asChild className="w-full">/);
  assert.match(css, /\.card-link \.card-link-target::after/);
  assert.match(css, /\.card-link :is\(button, a:not\(\.card-link-target\)\)/);
});
