import test from "node:test";
import assert from "node:assert/strict";
import { liveOpportunityView, demoOpportunityView, opportunityTabs, topClaims, methodologyVersion, initialTab } from "../lib/opportunity-view.ts";
import { opportunities, researchReports } from "../lib/demo-data.ts";

const v1 = { id: "o1", title: "Clinic billing", category: "Healthcare", description: "d", buyer: "Clinics", pain: "Billing", score: 57, confidence: "moderate", revenue: "$49/month", cost: "$5/month", risk: "k", scores: [80, 68, 78, 72, 58], icon: "workflow" };
const source = (key, extra = {}) => ({ source_key: key, url: `https://www.example.org/${key}`, title: `Title ${key}`, excerpt: `Quote ${key}`, retrieved_at: "2026-11-10", published_at: null, ...extra });
const v2 = { ...v1, evidence: [source("c1-s1", { stance: "supports" }), source("c1-s2", { stance: "contradicts" })], score_before_review: 72, score_cap: 85, penalty: 15, rationale: "why", critique: "doubt", falsification: "pilot", assumptions: ["a1"], validation: ["Interview ten clinics", "Run a paid pilot"] };
const claim = (kind, section, text, extra = {}) => ({ kind, section, text, source_keys: [], ...extra });
const v3 = { ...v2, methodology_version: 3, evidence: [source("c1-s1", { stance: "supports", reliability: "primary" }), source("c1-s2", { stance: "contradicts", reliability: "vendor" })], claims: [
  claim("assumption", "economics", "Clinics would pay $49.", { confirm: "Ask five owners." }),
  claim("inference", "buyer", "Small clinics feel it most.", { source_keys: ["c1-s1"] }),
  claim("observed", "pain", "Clinics lose slots weekly.", { source_keys: ["c1-s1"] }),
  claim("observed", "demand", "Owners pay for reminders.", { source_keys: ["c1-s1"] }),
] };

test("the methodology version is read from what the payload records", () => {
  assert.equal(methodologyVersion(v1), 1);
  assert.equal(methodologyVersion(v2), 2, "a review breakdown or a stance means v2");
  assert.equal(methodologyVersion({ ...v1, evidence: [source("a", { stance: "neutral" })] }), 2);
  assert.equal(methodologyVersion(v3), 3);
});

test("tabs depend on what the payload has: no Evidence tab without sources or claims", () => {
  assert.deepEqual(opportunityTabs(liveOpportunityView(v1)), ["overview", "economics", "validation"], "v1 without evidence");
  assert.deepEqual(opportunityTabs(liveOpportunityView(v2)), ["overview", "evidence", "economics", "validation"]);
  assert.deepEqual(opportunityTabs(liveOpportunityView(v3)), ["overview", "evidence", "economics", "validation"]);
  assert.deepEqual(opportunityTabs({ sources: [], claims: [claim("inference", "risk", "x")] }), ["overview", "evidence", "economics", "validation"]);
  const demo = demoOpportunityView(opportunities[0], researchReports[opportunities[0].id], text => text);
  assert.deepEqual(opportunityTabs(demo), ["overview", "evidence", "economics", "validation"], "the demo has the same tabs");
  assert.equal(initialTab("Evidence", opportunityTabs(liveOpportunityView(v2))), "evidence", "a URL tab is case-insensitive");
  assert.equal(initialTab("evidence", opportunityTabs(liveOpportunityView(v1))), "overview", "a tab the opportunity lacks falls back");
  assert.equal(initialTab(undefined, ["overview"]), "overview");
});

test("top claims put observations first, then inferences, then assumptions, keeping order within a kind", () => {
  assert.deepEqual(topClaims(v3.claims).map(c => c.text), ["Clinics lose slots weekly.", "Owners pay for reminders.", "Small clinics feel it most."]);
  assert.deepEqual(topClaims([]), []);
});

test("a live view keeps sources in listed order with numbers, domains, reliability and stance", () => {
  const view = liveOpportunityView({ ...v3, evidence: [...v3.evidence, source("c1-s1"), { ...source("c1-s9"), url: "javascript:alert(1)" }] });
  assert.deepEqual(view.sources.map(s => [s.number, s.key, s.domain, s.reliability, s.stance]), [
    [1, "c1-s1", "example.org", "primary", "supports"], [2, "c1-s2", "example.org", "vendor", "contradicts"], [3, "c1-s9", null, null, null],
  ], "a repeated key keeps one card");
  assert.equal(view.sources[2].url, null, "an unsafe URL is never linked");
  assert.deepEqual(view.confirmations, [{ claim: "Clinics would pay $49.", confirm: "Ask five owners." }]);
  assert.equal(view.breakdown.deduction, 15);
  assert.equal(view.firstTest, "Interview ten clinics");
  // Older payloads have no reliability, claims or breakdown fields and still build a view.
  const old = liveOpportunityView(v1);
  assert.deepEqual([old.sources, old.claims, old.assumptions, old.validation, old.firstTest], [[], [], [], [], null]);
});

test("the demo view carries its synthetic sources and translated fixed lines", () => {
  const o = opportunities[0];
  const view = demoOpportunityView(o, researchReports[o.id], text => `«${text}»`);
  assert.equal(view.kind, "demo");
  assert.equal(view.breakdown, null, "demo scores are illustrative");
  assert.equal(view.sources.length, researchReports[o.id].sources.length);
  assert.ok(view.sources.every(s => s.url === null && s.synthetic), "no links; every source is marked synthetic");
  assert.ok(view.assumptions.every(text => text.startsWith("«")), "fixed demo lines go through copy()");
  assert.deepEqual(view.validation, [], "the demo has no research-generated steps; it shares the fixed checklist");
  assert.equal(view.firstTest, researchReports[o.id].firstTest);
  assert.equal(view.sources[0].title, researchReports[o.id].sources[0].title, "source text arrives translated and is not translated twice");
});
