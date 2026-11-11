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
