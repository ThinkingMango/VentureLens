import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  signupSources, parseSignupSource, signupHref, isNewAccount, signupSourceCounts, SIGNUP_SOURCE_KEY, NEW_ACCOUNT_WINDOW_MS,
} from "../lib/signup-source.ts";
import { eventProps, onceEvents } from "../lib/events-core.ts";
import { requestEmailCode } from "../lib/email-auth.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("sign-up sources are a fixed list, and anything else is not a source", () => {
  for (const source of signupSources) assert.equal(parseSignupSource(source), source);
  for (const value of [undefined, null, "", "LANDING_HERO", "landing_hero ", "javascript:alert(1)", "unknown", 3, {}])
    assert.equal(parseSignupSource(value), null, String(value));
  assert.equal(signupHref("pricing_close"), "/signup?from=pricing_close");
});

test("only an account created in the last day counts as a sign-up, so existing founders logging in never do", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  assert.equal(isNewAccount("2026-11-13T11:59:00Z", now), true);
  assert.equal(isNewAccount(new Date(now.getTime() - NEW_ACCOUNT_WINDOW_MS).toISOString(), now), true);
  assert.equal(isNewAccount(new Date(now.getTime() - NEW_ACCOUNT_WINDOW_MS - 1).toISOString(), now), false);
  assert.equal(isNewAccount("2026-10-01T00:00:00Z", now), false);
  assert.equal(isNewAccount("2026-11-14T00:00:00Z", now), false, "a future date is not trusted");
  for (const value of [undefined, null, "", "not a date"]) assert.equal(isNewAccount(value, now), false);
});

test("the sign-up event carries only a known source, or unknown, and is recorded once per account", () => {
  assert.deepEqual(eventProps("signup_completed", { source: "header" }), { source: "header" });
  assert.deepEqual(eventProps("signup_completed", { source: "unknown" }), { source: "unknown" });
  assert.equal(eventProps("signup_completed", { source: "newsletter" }), null);
  assert.equal(eventProps("signup_completed", { source: "header", email: "a@b.co" }), null, "no extra fields");
  assert.equal(eventProps("signup_completed", {}), null);
  assert.deepEqual([...onceEvents], ["signup_completed"]);
});

test("the sign-up request attaches the source only when there is one", async () => {
  const calls = [];
  const client = { auth: { signInWithOtp: async (args) => { calls.push(args); return { error: null }; } } };
  await requestEmailCode(client, "founder@example.com", "https://x.test/auth/callback", "landing_hero");
  await requestEmailCode(client, "founder@example.com", "https://x.test/auth/callback");
  assert.deepEqual(calls[0].options, { shouldCreateUser: true, emailRedirectTo: "https://x.test/auth/callback", data: { [SIGNUP_SOURCE_KEY]: "landing_hero" } });
  assert.deepEqual(calls[1].options, { shouldCreateUser: true, emailRedirectTo: "https://x.test/auth/callback" });
});

test("the admin breakdown counts sources largest first, with unknown and unreadable props last", () => {
  const rows = [
    { props: { source: "header" } }, { props: { source: "landing_hero" } }, { props: { source: "landing_hero" } },
    { props: { source: "unknown" } }, { props: null }, { props: { source: "pricing_hero" } },
  ];
  assert.deepEqual(signupSourceCounts(rows), [
    { source: "landing_hero", count: 2 }, { source: "header", count: 1 }, { source: "pricing_hero", count: 1 }, { source: "unknown", count: 2 },
  ]);
  assert.deepEqual(signupSourceCounts([]), []);
});

test("every sign-up link names its source, the callback records new accounts only, and the policy says so", () => {
  for (const file of ["landing", "pricing", "public-shell", "app-shell"])
    assert.doesNotMatch(read(`components/${file}.tsx`), /href="\/signup/, file);
  const linked = ["landing", "pricing", "public-shell", "app-shell"].map((file) => read(`components/${file}.tsx`)).join("\n");
  for (const source of signupSources) assert.ok(linked.includes(`"${source}"`), `no link uses ${source}`);
  assert.match(read("components/auth-screen.tsx"), /parseSignupSource\(new URLSearchParams\(window\.location\.search\)\.get\("from"\)\)/);
  const callback = read("app/auth/callback/route.ts");
  assert.match(callback, /!profile\?\.onboarding_completed && isNewAccount\(user\.created_at, new Date\(\)\)/);
  assert.match(callback, /after\(\(\) => trackOnce\("signup_completed"/);
  // No cookie carries the source; the Privacy Policy names what is stored.
  assert.doesNotMatch(read("lib/signup-source.ts") + read("components/auth-screen.tsx"), /document\.cookie|cookies\(\)/);
  assert.match(read("components/privacy.tsx"), /which sign-up button on our site you used/);
  assert.match(read("components/privacy.tsx"), /which sign-up button you came from/);
  assert.match(read("lib/contact.ts"), /privacyUpdatedAt = "2026-11-13T00:00:00Z"/);
});
