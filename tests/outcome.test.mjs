import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseCandidates, evidenceGate, outcomeSuggestions, researchOutcome, outcomeSchema, gateReasons } from "../lib/research-core.ts";

// Shared fixtures: each candidate is built to fail (or pass) one specific rule.
const page = (key, candidate, url, text) => ({ source_key: key, candidate_id: candidate, url, title: `Page ${key}`, excerpt: text, retrieved_at: "2026-11-10T00:00:00.000Z", published_at: null });
const cls = (key, text, { reliability = "secondary", stance = "supports", kind = "pain", relevant = true } = {}) => ({ source_key: key, relevant, kind, reliability, stance, quote: text, claim: "claim" });
const candidate = key => ({ key, title: `Idea ${key}`, buyer: `Buyer ${key}`, pain: "pain", solution: "solution", advantage: "advantage", query: `query for ${key}` });
const sentence = n => `Independent buyers repeatedly describe this costly problem in detail, report number ${n}.`;

function fixture() {
  const evidence = [];
  const classifications = [];
  const add = (key, cand, url, options) => {
    const text = sentence(evidence.length);
    evidence.push(page(key, cand, url, text));
    if (options !== null) classifications.push(cls(key, text, options));
  };
  // c1 PASSED: two independent supporting domains, secondary pain evidence.
  add("c1-s1", "c1", "https://forum.example-a.org/1"); add("c1-s2", "c1", "https://news.example-b.com/2");
  // c2 SEARCH_FAILED: no sources, retrieval skipped.
  // c3 NO_SOURCES: sources read but none relevant; one neutral.
  add("c3-s1", "c3", "https://c3.org/1", { relevant: false }); add("c3-s2", "c3", "https://c3b.org/2", { stance: "neutral" });
  // c4 CONTRADICTED: the only relevant sources contradict.
  add("c4-s1", "c4", "https://c4.org/1", { stance: "contradicts" }); add("c4-s2", "c4", "https://c4b.org/1", { stance: "contradicts" });
  // c5 SINGLE_DOMAIN: two supporting pages, one publisher (subdomains count once).
  add("c5-s1", "c5", "https://blog.c5.org/1"); add("c5-s2", "c5", "https://www.c5.org/2");
  // c6 VENDOR_ONLY plus a contradicting source: two vendor domains support, an independent one contradicts.
  add("c6-s1", "c6", "https://vendor-one.io/1", { reliability: "vendor" }); add("c6-s2", "c6", "https://vendor-two.io/2", { reliability: "vendor" });
  add("c6-s3", "c6", "https://critic.org/3", { stance: "contradicts" });
  // c7 VENDOR_ONLY by kind: two independent domains, but they describe competition, not pain or demand.
  add("c7-s1", "c7", "https://c7.org/1", { kind: "competition" }); add("c7-s2", "c7", "https://c7b.org/1", { kind: "competition" });
  // c8 passes the gate but the review rejects it.
  add("c8-s1", "c8", "https://c8.org/1", { reliability: "primary", kind: "demand" }); add("c8-s2", "c8", "https://c8b.org/1");
  const candidates = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"].map(candidate);
  const reviews = [{ candidate_id: "c1", reject: false }, { candidate_id: "c8", reject: true }];
  return { candidates, evidence, classifications, reviews, retrievalFailures: ["c2"] };
}

test("each candidate gets the first rule it failed, in the order the pipeline applies them", () => {
  const diagnoses = diagnoseCandidates(fixture());
  assert.deepEqual(diagnoses.map(d => [d.key, d.reason]), [
    ["c1", "PASSED"], ["c2", "SEARCH_FAILED"], ["c3", "NO_SOURCES"], ["c4", "CONTRADICTED"],
    ["c5", "SINGLE_DOMAIN"], ["c6", "VENDOR_ONLY"], ["c7", "VENDOR_ONLY"], ["c8", "REVIEW_REJECTED"],
  ]);
  const c6 = diagnoses.find(d => d.key === "c6");
  assert.deepEqual({ supporting: c6.supportingDomains, nonVendor: c6.nonVendorSupport, contradicting: c6.contradicting }, { supporting: 2, nonVendor: false, contradicting: 1 }, "vendor-only plus a contradicting source is VENDOR_ONLY");
  assert.equal(diagnoses.find(d => d.key === "c5").supportingDomains, 1);
});

test("diagnoses agree with evidenceGate on every shared fixture and on 500 generated candidates", () => {
  const passes = reason => ["PASSED", "REVIEW_REJECTED", "NOT_EVALUATED"].includes(reason);
  const check = ({ candidates, evidence, classifications, reviews, retrievalFailures }) => {
    for (const d of diagnoseCandidates({ candidates, evidence, classifications, reviews, retrievalFailures })) {
      const gate = evidenceGate(d.key, evidence, classifications);
      assert.equal(passes(d.reason), gate.sources.length > 0, `${d.key}: ${d.reason}`);
      if (gate.sources.length) assert.equal(d.supportingDomains, gate.supportingDomains);
    }
  };
  check(fixture());
  // Seeded generator: random domains (some shared, some subdomains), stances, kinds, reliabilities and relevance.
  let seed = 42;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = list => list[Math.floor(random() * list.length)];
  for (let round = 0; round < 50; round++) {
    const evidence = [], classifications = [], candidates = [];
    for (let c = 1; c <= 10; c++) {
      const key = `c${c}`;
      candidates.push(candidate(key));
      for (let s = 1; s <= Math.floor(random() * 5); s++) {
        const text = sentence(`${round}-${key}-${s}`);
        const host = `${pick(["", "www.", "news."])}${pick(["a", "b", "c", "d"])}.${pick(["org", "com"])}`;
        evidence.push(page(`${key}-s${s}`, key, `https://${host}/${s}`, text));
        if (random() < 0.9) classifications.push(cls(`${key}-s${s}`, random() < 0.9 ? text : "a quote that is not in the page at all", {
          relevant: random() < 0.85, stance: pick(["supports", "supports", "contradicts", "neutral"]),
          kind: pick(["pain", "demand", "competition", "regulation", "other"]), reliability: pick(["primary", "secondary", "vendor", "unknown"]),
        }));
      }
    }
    check({ candidates, evidence, classifications, reviews: undefined, retrievalFailures: [] });
  }
});

test("before review a candidate that passes the gate counts as passed; after review a missing review is NOT_EVALUATED", () => {
  const { candidates, evidence, classifications } = fixture();
  const beforeReview = diagnoseCandidates({ candidates, evidence, classifications });
  assert.equal(beforeReview.find(d => d.key === "c8").reason, "PASSED");
  const missing = diagnoseCandidates({ candidates, evidence, classifications, reviews: [{ candidate_id: "c1", reject: false }] });
  assert.equal(missing.find(d => d.key === "c8").reason, "NOT_EVALUATED");
  assert.ok(gateReasons.includes("NOT_EVALUATED"));
});

test("sources keep URL, title, domain, reliability and stance; unclassified and unsafe sources are handled", () => {
  const { candidates, evidence, classifications } = fixture();
  const withExtra = [...evidence, page("c3-s3", "c3", "https://unclassified.net/x", "No classification for this one."), page("c3-s4", "c3", "javascript:alert(1)", "Unsafe")];
  const c3 = diagnoseCandidates({ candidates, evidence: withExtra, classifications }).find(d => d.key === "c3");
  assert.deepEqual(c3.sources.map(s => [s.domain, s.reliability, s.stance, s.relevant]), [["c3.org", "secondary", "supports", false], ["c3b.org", "secondary", "neutral", true], ["unclassified.net", null, null, null]], "unsafe URLs are dropped; irrelevant pages are marked");
  assert.equal(c3.sources[0].title, "Page c3-s1");
  assert.ok(c3.sources.every(s => !("excerpt" in s)), "excerpts stay out of the outcome");
});

test("suggestions are fixed keys chosen by the dominant reason, always offering to verify one idea", () => {
  assert.deepEqual(outcomeSuggestions(["VENDOR_ONLY", "VENDOR_ONLY", "SINGLE_DOMAIN"], "founder"), ["TRY_MARKET_MODE", "VERIFY_SPECIFIC_IDEA"]);
  assert.deepEqual(outcomeSuggestions(["VENDOR_ONLY", "VENDOR_ONLY", "SINGLE_DOMAIN"], "market"), ["VERIFY_SPECIFIC_IDEA"], "market mode is already market-led");
  assert.deepEqual(outcomeSuggestions(["SINGLE_DOMAIN", "SINGLE_DOMAIN", "NO_SOURCES", "SEARCH_FAILED"], "combined"), ["NARROW_BUYER", "CHANGE_GEOGRAPHY", "VERIFY_SPECIFIC_IDEA"], "ties count as dominant");
  assert.deepEqual(outcomeSuggestions(["NO_SOURCES", "SEARCH_FAILED", "CONTRADICTED"], "combined"), ["CHANGE_GEOGRAPHY", "VERIFY_SPECIFIC_IDEA"]);
  assert.deepEqual(outcomeSuggestions(["PASSED", "PASSED"], "combined"), ["VERIFY_SPECIFIC_IDEA"], "passed candidates never trigger a suggestion");
  assert.deepEqual(outcomeSuggestions([], "founder"), ["VERIFY_SPECIFIC_IDEA"]);
  const reasons = ["VENDOR_ONLY", "SINGLE_DOMAIN", "VENDOR_ONLY", "NO_SOURCES"];
  assert.deepEqual(outcomeSuggestions(reasons, "founder"), outcomeSuggestions([...reasons].reverse(), "founder"), "order of candidates does not matter");
});

test("the outcome checkpoint counts what was searched and parses with its schema", () => {
  const outcome = researchOutcome({ ...fixture(), mode: "founder" });
  assert.deepEqual(outcome.counts, { candidates: 8, sources: 15, passed: 1 });
  assert.equal(outcome.version, 1);
  assert.deepEqual(outcomeSchema.parse(JSON.parse(JSON.stringify(outcome))), outcome, "survives a JSON round trip");
  assert.equal(outcomeSchema.safeParse({ ...outcome, version: 2 }).success, false, "unknown versions are not misread");
  assert.equal(outcomeSchema.safeParse({ ...outcome, suggestions: ["Write a better brief"] }).success, false, "suggestions are keys, never text");
});

test("demo outcome text and the demo history status are translated in every catalogue", async () => {
  // These reach copy() through variables, which the literal-call catalogue test cannot see.
  const { readFileSync } = await import("node:fs");
  const { messageKey } = await import("../i18n/config.ts");
  const { demoOutcome } = await import("../lib/demo-data.ts");
  const catalogs = ["en", "zh-Hans", "zh-Hant"].map(locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).ui);
  const sources = ["Nothing passed", ...demoOutcome.candidates.flatMap(c => [c.title, c.buyer])];
  for (const source of sources) for (const ui of catalogs) assert.ok(ui[messageKey(source)], source);
});

test("outcome_viewed records reason codes and counts only, for runs where nothing passed", async () => {
  const { readFileSync } = await import("node:fs");
  const { eventProps } = await import("../lib/events-core.ts");
  const reasonCounts = Object.fromEntries(gateReasons.map((reason, i) => [reason, i + 1]));
  assert.deepEqual(eventProps("outcome_viewed", { reasonCounts }), { reasonCounts }, "every reason code is a valid event key");
  const page = readFileSync(new URL("../app/(workspace)/research/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /detail\.status === "failed" && detail\.error_code === "INSUFFICIENT_EVIDENCE" && outcome\)/);
  assert.match(page, /after\(\(\) => track\("outcome_viewed", \{ userId: user\.id, props: \{ reasonCounts \} \}\)\)/, "recorded after the response, never blocking the page");
});
