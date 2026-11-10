import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, canStartNext, evaluate, loadFixture, main, summarize, MAX_SESSION_USD } from "../scripts/research-eval.mjs";

const fixturePath = fileURLToPath(new URL("./fixtures/eval-briefs.json", import.meta.url));
const script = fileURLToPath(new URL("../scripts/research-eval.mjs", import.meta.url));
const base = ["--base-url", "http://127.0.0.1:9", "--cookie-file", "/dev/null"];

test("the evaluation refuses to run without --confirm-cost and --max-usd", () => {
  assert.match(parseArgs([]).error, /--confirm-cost/);
  assert.match(parseArgs(["--max-usd", "5", ...base]).error, /--confirm-cost/);
  assert.match(parseArgs(["--confirm-cost", ...base]).error, /--max-usd/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", "0", ...base]).error, /positive/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", "abc", ...base]).error, /positive/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", String(MAX_SESSION_USD + 1), ...base]).error, /reviewed change/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", "5", "--cookie-file", "x"]).error, /--base-url/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", "5", "--base-url", "ftp://x", "--cookie-file", "x"]).error, /http/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", "1", "--per-run-usd", "2", ...base]).error, /cannot exceed/);
  assert.match(parseArgs(["--confirm-cost", "--max-usd", "5", "--surprise", "1", ...base]).error, /Unknown option/);
  const { options } = parseArgs(["--confirm-cost", "--max-usd", "5", "--base-url", "https://dev.example.com/path", "--cookie-file", "c.txt", "--brief", "b01", "--brief", "b09"]);
  assert.equal(options.maxUsd, 5);
  assert.equal(options.baseUrl, "https://dev.example.com");
  assert.deepEqual(options.briefs, ["b01", "b09"]);
});

function listen(handler) {
  return new Promise(resolve => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
const run = args => new Promise(resolve => execFile(process.execPath, ["--experimental-strip-types", script, ...args], (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));

test("run from the command line without the flags, it exits with an error before any request", async t => {
  let requests = 0;
  const { server, url } = await listen((_req, res) => { requests++; res.end("{}"); });
  t.after(() => server.close());
  for (const args of [[], ["--max-usd", "5", "--base-url", url, "--cookie-file", "/dev/null"], ["--confirm-cost", "--base-url", url, "--cookie-file", "/dev/null"]]) {
    const result = await run(args);
    assert.equal(result.code, 1, args.join(" "));
    assert.match(result.stderr, /Refusing to run/);
  }
  assert.equal(requests, 0, "no request reaches the deployment");
});

test("the session stops before a run that could take spend past the cap", () => {
  assert.equal(canStartNext(0, 0.25, 0.5), true);
  assert.equal(canStartNext(0.25, 0.25, 0.5), true, "exactly at the cap is allowed");
  assert.equal(canStartNext(0.3, 0.25, 0.5), false);
});

test("the fixture covers every mode, all three languages and at least six markets, and every brief is valid", () => {
  const { profile, briefs } = loadFixture(fixturePath);
  assert.ok(profile.name);
  assert.ok(briefs.length >= 20 && briefs.length <= 30, `${briefs.length} briefs`);
  assert.deepEqual([...new Set(briefs.map(b => b.brief.discovery_mode))].sort(), ["combined", "founder", "market"]);
  assert.deepEqual([...new Set(briefs.map(b => b.brief.language))].sort(), ["en", "zh-Hans", "zh-Hant"]);
  assert.ok(new Set(briefs.map(b => b.brief.geography)).size >= 6);
  assert.equal(new Set(briefs.map(b => b.id)).size, briefs.length, "ids are unique");
  assert.deepEqual(loadFixture(fixturePath, ["b09", "b01"]).briefs.map(b => b.id), ["b01", "b09"]);
  assert.equal(loadFixture(fixturePath, [], 3).briefs.length, 3);
  assert.throws(() => loadFixture(fixturePath, ["b99"]), /Unknown brief id/);
});

// A fake deployment: each run completes on its second poll, costs $0.10 and reports a $0.25 budget.
function fakeApi({ finish = true } = {}) {
  const calls = [];
  let next = 0;
  const runs = new Map();
  const request = async (method, path, body) => {
    calls.push(`${method} ${path}`);
    if (path === "/api/workspace") return { status: 200, body: { ok: true } };
    if (method === "POST" && path === "/api/research") {
      const id = `00000000-0000-4000-8000-00000000000${++next}`;
      runs.set(id, { polls: 0, brief: body.brief });
      return { status: 202, body: { id } };
    }
    const id = path.split("/").pop();
    const state = runs.get(id);
    state.polls++;
    const done = finish && state.polls >= 2;
    const completed = state.brief.discovery_mode !== "market";
    const evidence = [{ url: "https://a.org/1", stance: "supports" }, { url: "https://b.org/2", stance: "supports" }];
    return { status: 200, body: {
      id, status: done ? (completed ? "completed" : "failed") : "running", error_code: done && !completed ? "INSUFFICIENT_EVIDENCE" : null,
      created_at: "2026-11-01T00:00:00Z", completed_at: done ? "2026-11-01T00:04:00Z" : null,
      usage: { committed_usd: done ? 0.1 : 0.02, budget_usd: 0.25 },
      report: done && completed ? { opportunities: [{ evidence }, { evidence }] } : null,
    } };
  };
  return { request, calls };
}

test("runs go one at a time until the cap, and the results feed the same metrics as /admin/quality", async () => {
  const { briefs, profile } = loadFixture(fixturePath);
  const api = fakeApi();
  const outcome = await evaluate({ briefs, profile, maxUsd: 0.5, perRunUsd: 0.25, pollMs: 0, timeoutMs: 60_000, request: api.request, sleep: async () => {} });
  // $0 + 0.25, $0.10 + 0.25 and $0.20 + 0.25 fit within $0.50; $0.30 + 0.25 does not.
  assert.equal(outcome.results.length, 3);
  assert.equal(outcome.stoppedBy, "max-usd");
  assert.ok(Math.abs(outcome.spentUsd - 0.3) < 1e-9);
  assert.equal(api.calls[0], "POST /api/workspace", "the fixed profile is saved first");
  assert.equal(api.calls.filter(call => call === "POST /api/research").length, 3);
  const { metrics, briefs: rows } = summarize(outcome.results);
  assert.equal(metrics.runs.total, 3);
  assert.equal(metrics.opportunitiesPerCompletedRun.mean, 2);
  assert.equal(metrics.supportingDomainsMedian, 2);
  assert.equal(metrics.vendorShare, null, "not available through the research API");
  assert.deepEqual(rows.map(r => r.id), ["b01", "b02", "b03"]);
  assert.equal(rows[1].status, "failed");
  assert.equal(rows[1].error_code, "INSUFFICIENT_EVIDENCE");
  assert.equal(rows[0].duration_ms, 240_000);
});

test("a run that does not finish in time counts at its whole budget and ends the session", async () => {
  const { briefs, profile } = loadFixture(fixturePath, [], 3);
  const api = fakeApi({ finish: false });
  let clock = 0;
  const outcome = await evaluate({ briefs, profile, maxUsd: 5, perRunUsd: 0.25, pollMs: 1000, timeoutMs: 5000, request: api.request, sleep: async ms => { clock += ms; }, now: () => clock });
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].status, "timeout");
  assert.equal(outcome.spentUsd, 0.25);
  assert.equal(outcome.stoppedBy, "timeout");
});

test("a start the API refuses ends the session without spending", async () => {
  const { briefs, profile } = loadFixture(fixturePath, [], 2);
  const request = async (method, path) => (path === "/api/workspace" ? { status: 200, body: {} } : { status: 403, body: { code: "DEV_QUOTA_EXCEEDED" } });
  const outcome = await evaluate({ briefs, profile, maxUsd: 5, perRunUsd: 0.25, pollMs: 0, timeoutMs: 1000, request, sleep: async () => {} });
  assert.equal(outcome.stoppedBy, "start: DEV_QUOTA_EXCEEDED");
  assert.equal(outcome.spentUsd, 0);
  assert.equal(outcome.results[0].status, "not_started");
});

test("a full session over HTTP sends the cookie and same-origin headers and writes the JSON and Markdown reports", async t => {
  const dir = mkdtempSync(join(tmpdir(), "vl-eval-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cookieFile = join(dir, "cookie.txt");
  writeFileSync(cookieFile, "Cookie: sb-dev-auth-token=abc\n");
  const api = fakeApi();
  const seen = [];
  const { server, url } = await listen(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    seen.push({ cookie: req.headers.cookie, origin: req.headers.origin, type: req.headers["content-type"] });
    const { status, body } = await api.request(req.method, req.url, raw ? JSON.parse(raw) : undefined);
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  t.after(() => server.close());
  const originalLog = console.log;
  console.log = () => {};
  let code;
  try {
    code = await main(["--confirm-cost", "--max-usd", "0.3", "--base-url", url, "--cookie-file", cookieFile, "--out-dir", join(dir, "out"), "--poll-seconds", "0.001"], { fetch: globalThis.fetch, sleep: async () => {} });
  } finally {
    console.log = originalLog;
  }
  assert.equal(code, 0, "stopping at the cap is a normal end");
  assert.ok(seen.every(request => request.cookie === "sb-dev-auth-token=abc" && request.origin === url));
  const files = readdirSync(join(dir, "out")).sort();
  assert.equal(files.length, 2);
  assert.match(files[0], /^\d{4}-\d{2}-\d{2}-[0-9a-f]+\.json$|^\d{4}-\d{2}-\d{2}-unknown\.json$/);
  const record = JSON.parse(readFileSync(join(dir, "out", files[0]), "utf8"));
  assert.equal(record.results.length, 1, "$0.30 allows one $0.25 run, then $0.10 + $0.25 does not fit");
  assert.equal(record.results[0].evidence, undefined, "source lists stay out of the saved record");
  const markdown = readFileSync(join(dir, "out", files[1]), "utf8");
  assert.match(markdown, /^# Research quality evaluation/);
  assert.match(markdown, /\| b01 \| combined \| en \| completed \|/);
  assert.match(markdown, /stopped early: max-usd/);
});
