import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as workspaceSchema from "../lib/workspace-schema.ts";

const require = createRequire(import.meta.url);
// Transpiles a TS/TSX module and evaluates it with stand-ins for app-internal imports.
function loadModule(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env: {} });
  return module.exports;
}

const excerpt = "Agencies report spending ten hours every week preparing proposals for new clients. ".repeat(20);
const payload = {
  category: "Services", description: "Drafting assistant", buyer: "Agencies", pain: "Slow proposals", confidence: "limited",
  revenue: "$500/month, unverified", cost: "$80/month, unverified", risk: "Unverified demand", scores: [70, 60, 50, 80, 40], icon: "workflow",
  candidate_id: "c1",
  evidence: [1, 2, 3, 4].map(i => ({ source_key: `c1-s${i}`, url: `https://publisher${i}.org/report`, title: `Report ${i}`, excerpt, retrieved_at: "2026-11-09T00:00:00.000Z", published_at: null })),
  assumptions: ["Agencies will pay monthly"], validation: ["Interview ten agencies", "Run a paid pilot"],
  rationale: "Pain is high because c1-s1 reports ten hours a week. ".repeat(30), critique: "Free templates exist. ".repeat(30),
  falsification: "Offer a paid pilot to ten agencies.", penalty: 5,
};
function workspaceModule(rows, projects = []) {
  const tables = {
    founder_profiles: { name: "Alex", role: "Founder", industry: "Services", skills: "Sales", hours: "10–20 hours", budget: "Under $1,000", goal: "Side business", onboarding_completed: true },
    research_projects: projects, research_runs: [], saved_opportunities: [], research_dev_access: null,
    opportunities: rows,
  };
  const from = table => {
    const filters = {};
    const query = {
      select: () => query, order: () => query, eq: (key, value) => { filters[key] = value; return query; },
      maybeSingle: async () => ({ data: table === "opportunities" ? rows.find(row => row.id === filters.id) ?? null : tables[table], error: null }),
      then: resolve => resolve({ data: tables[table], error: null }),
    };
    return query;
  };
  const module = loadModule("../lib/workspace.ts", {
    "server-only": {}, "react": { cache: fn => fn }, "next/navigation": { redirect: () => { throw new Error("redirect"); } },
    "@/lib/supabase/server": { createClient: async () => ({ from }) }, "@/lib/workspace-schema": workspaceSchema,
  });
  return { module, supabase: { from } };
}

test("the workspace list every page receives omits excerpts and review text; the opportunity page reads them in full", async () => {
  const row = { id: "5f0d6f8e-7a39-4f8b-9a43-0d1f2b8a9c11", title: "Proposal copilot", score: 66, payload };
  const { module, supabase } = workspaceModule([row]);
  const workspace = await module.readWorkspace(supabase, { id: "user", email: "a@example.com" });
  const [listed] = workspace.opportunities;
  // Cards still get what they render: scores, economics, the first validation step and countable source links.
  assert.deepEqual([listed.title, listed.score, listed.revenue, listed.validation[0], listed.evidence.length], ["Proposal copilot", 66, payload.revenue, "Interview ten agencies", 4]);
  assert.deepEqual(listed.evidence.map(e => e.url), payload.evidence.map(e => e.url));
  for (const field of ["rationale", "critique", "falsification", "assumptions"]) assert.equal(listed[field], undefined, field);
  assert.ok(listed.evidence.every(e => e.excerpt === undefined), "no excerpt in the list");

  const full = await module.readOpportunity(supabase, "user", row.id);
  assert.equal(full.evidence[0].excerpt, excerpt);
  assert.equal(full.rationale, payload.rationale);
  assert.equal(full.critique, payload.critique);
  assert.deepEqual(full.assumptions, payload.assumptions);
  assert.equal(await module.readOpportunity(supabase, "user", "00000000-0000-4000-8000-000000000000"), null);

  const before = JSON.stringify(workspaceSchema.opportunitySchema.parse({ ...payload, id: row.id, title: row.title, score: row.score })).length;
  const after = JSON.stringify(listed).length;
  assert.ok(after < before / 4, `list entry is ${after} bytes against ${before} for the full record`);
});

test("live billing shows the same research allowance as the sidebar and never claims none was provisioned", () => {
  const passthrough = ({ children }) => createElement("div", null, children);
  const { Billing } = loadModule("../components/billing.tsx", {
    "@/i18n/use-copy": { useCopy: () => text => text },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "sonner": { toast: { info: () => {} } },
    "@/components/shared": { PageHeader: ({ title, description }) => createElement("header", null, title, " ", description), DemoNote: () => null },
    "@/components/ui/button": { Button: passthrough }, "@/components/ui/badge": { Badge: passthrough },
    "@/components/pricing": { PricingCards: () => null },
    "@/components/demo-provider": { useDemo: () => ({ isDemo: false }) },
    "@/components/research-access-card": { ResearchAccessCard: () => createElement("aside", null, "ACCESS-CARD") },
  });
  const html = renderToStaticMarkup(createElement(Billing));
  assert.match(html, /ACCESS-CARD/);
  assert.match(html, /Paid research credits are not available yet/);
  assert.doesNotMatch(html, /No credits, charges, subscriptions, or payment methods have been provisioned/);
});

test("every route sends anti-framing headers and a CSP that leaves scripts alone", async () => {
  const config = loadModule("../next.config.ts", {
    "workflow/next": { withWorkflow: value => value },
    "next-intl/plugin": { default: () => value => value },
  }).default;
  const rules = await config.headers();
  const all = rules.find(rule => rule.source === "/:path*");
  const header = name => all.headers.find(h => h.key === name)?.value;
  assert.equal(header("X-Frame-Options"), "SAMEORIGIN");
  const csp = header("Content-Security-Policy");
  for (const directive of ["frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"]) assert.ok(csp.includes(directive), directive);
  assert.doesNotMatch(csp, /script-src|default-src/, "no directive that would block Next.js inline scripts without nonces");
  // Framing protection must not depend on a route allowlist, which previously left /admin and /auth/confirm out.
  assert.ok(!rules.some(rule => rule !== all && rule.headers.some(h => h.key === "X-Frame-Options")));
});

test("password-era routes are permanent router redirects to email sign-in", async () => {
  const config = loadModule("../next.config.ts", {
    "workflow/next": { withWorkflow: value => value },
    "next-intl/plugin": { default: () => value => value },
  }).default;
  const redirects = await config.redirects();
  assert.deepEqual(redirects, ["/forgot-password", "/reset-password", "/verify-email"].map(source => ({ source, destination: "/login", permanent: true })));
});

test("live workspace components never import demo fixtures or the chart statically", () => {
  const imports = path => [...readFileSync(new URL(`../${path}`, import.meta.url), "utf8").matchAll(/^import[^;]*?from\s+"([^"]+)"/gm)].map(m => m[1]);
  const demoOnly = ["@/lib/demo-data", "@/i18n/demo", "@/components/score-chart", "@/components/demo-dashboard", "@/components/demo-research-results"];
  for (const path of ["components/shared.tsx", "components/opportunity-card.tsx", "components/live-workspace.tsx", "components/dashboard.tsx", "components/research-results.tsx", "components/billing.tsx", "components/app-shell.tsx"]) {
    for (const source of imports(path)) assert.ok(!demoOnly.includes(source), `${path} imports ${source}`);
  }
  // The demo views are still reachable, through lazily loaded modules.
  assert.match(readFileSync(new URL("../components/dashboard.tsx", import.meta.url), "utf8"), /dynamic\(\(\) => import\("@\/components\/demo-dashboard"\)/);
  assert.match(readFileSync(new URL("../components/research-results.tsx", import.meta.url), "utf8"), /import\("@\/components\/demo-research-results"\)/);
});

test("saved briefs load with their industry and model lists, and briefs saved before multi-select read as lists of one", async () => {
  const at = "2026-11-09T00:00:00Z";
  const projects = [
    { id: "p1", user_id: "user", name: "Lists", sector: "Healthcare", model: "B2B subscription", sectors: ["Healthcare", "Legal & compliance"], models: ["B2B subscription", "Productized service"], geography: "United States", context: "", discovery_mode: "combined", created_at: at, updated_at: at },
    // A row read before the list migration is applied has no list columns at all.
    { id: "p2", user_id: "user", name: "Earlier", sector: "Education", model: "Productized service", geography: "Japan", context: null, discovery_mode: null, created_at: at },
  ];
  const { module, supabase } = workspaceModule([], projects);
  const { projects: loaded } = await module.readWorkspace(supabase, { id: "user", email: "a@example.com" });
  assert.deepEqual(loaded, [
    { id: "p1", name: "Lists", sectors: ["Healthcare", "Legal & compliance"], models: ["B2B subscription", "Productized service"], geography: "United States", context: "", discovery_mode: "combined", created_at: at },
    { id: "p2", name: "Earlier", sectors: ["Education"], models: ["Productized service"], geography: "Japan", context: "", discovery_mode: undefined, created_at: at },
  ]);
  // Both are valid briefs to start from again.
  for (const project of loaded) assert.equal(workspaceSchema.projectSchema.safeParse(project).success, true, project.name);
  // Stored briefs keep the first choice in the single-value columns as well as the lists.
  assert.deepEqual(workspaceSchema.briefColumns({ ...workspaceSchema.emptyBrief, sectors: ["Healthcare", "Education"], models: ["API or data product", "B2B subscription"] }),
    { ...workspaceSchema.emptyBrief, sectors: ["Healthcare", "Education"], models: ["API or data product", "B2B subscription"], sector: "Healthcare", model: "API or data product" });
});
