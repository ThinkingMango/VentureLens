import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  emailSchema,
  emailCodeSchema,
  emailCodeMinLength,
  emailCodeMaxLength,
  emailCodeInputPattern,
  normalizeEmailCode,
  emailCodeResendSeconds,
  emailAuthError,
  requestEmailCode,
  verifyEmailCode,
  parseEmailLink,
  verifyEmailLink,
} from "../lib/email-auth.ts";
import { messageKey, locales } from "../i18n/config.ts";

test("email and code input are normalized and validated", () => {
  assert.equal(
    emailSchema.parse("  founder@company.com  "),
    "founder@company.com",
  );
  for (const email of ["", "not-an-email", "a".repeat(255) + "@company.com"])
    assert.equal(emailSchema.safeParse(email).success, false);
  assert.equal(emailCodeMinLength, 6);
  assert.equal(emailCodeMaxLength, 10);
  const inputPattern = new RegExp(`^${emailCodeInputPattern}$`);
  for (const code of ["012345", "0123456", "01234567", "012345678", "0123456789"]) {
    assert.equal(emailCodeSchema.parse(code), code);
    assert.equal(inputPattern.test(code), true);
  }
  for (const [input, expected] of [
    [" 012345 ", "012345"],
    ["0123 4567", "01234567"],
    ["0123-4567", "01234567"],
    ["\u20090123\u00a04567\n", "01234567"],
    ["０１２３４５６７", "01234567"],
  ]) {
    assert.equal(normalizeEmailCode(input), expected);
    assert.equal(emailCodeSchema.parse(input), expected);
  }
  for (const code of ["", "12345", "12345678901", "abcdef", "1234a5678", "1234.5678"]) {
    assert.equal(emailCodeSchema.safeParse(code).success, false, code);
    assert.equal(inputPattern.test(normalizeEmailCode(code)), false, code);
  }
  assert.equal(normalizeEmailCode("12345678901"), "12345678901", "Never truncate an overlong code into a different valid code");
  assert.equal(normalizeEmailCode("1234a5678"), "1234a5678", "Never discard letters and accidentally verify a different code");
  assert.equal(emailCodeResendSeconds, 60);
});

test("new and returning users use the same native passwordless request", async () => {
  let input;
  const result = { data: { user: null, session: null }, error: null };
  const client = {
    auth: {
      signInWithOtp: async (value) => {
        input = value;
        return result;
      },
    },
  };
  assert.equal(
    await requestEmailCode(
      client,
      " founder@company.com ",
      "https://app.test/auth/callback",
    ),
    result,
  );
  assert.deepEqual(input, {
    email: "founder@company.com",
    options: {
      shouldCreateUser: true,
      emailRedirectTo: "https://app.test/auth/callback",
    },
  });
  assert.throws(() =>
    requestEmailCode(client, "bad", "https://app.test/auth/callback"),
  );
});

test("verification submits only the email, code, and email OTP type", async () => {
  let input;
  const result = { data: { session: null }, error: { code: "otp_expired" } };
  const client = {
    auth: {
      verifyOtp: async (value) => {
        input = value;
        return result;
      },
    },
  };
  for (const code of ["012345", "0123456", "01234567", "012345678", "0123456789", "０１２３ ４５６７"]) {
    assert.equal(
      await verifyEmailCode(client, " founder@company.com ", code),
      result,
    );
    assert.deepEqual(input, {
      email: "founder@company.com",
      token: normalizeEmailCode(code),
      type: "email",
    });
  }
  input = undefined;
  for (const code of ["bad", "12345", "12345678901", "1234a5678"])
    assert.throws(() => verifyEmailCode(client, "founder@company.com", code));
  assert.equal(input, undefined, "Malformed codes never reach the provider");
});

test("provider errors give safe, translated recovery guidance", () => {
  const errors = [
    { code: "otp_expired" },
    { code: "otp_disabled" },
    { code: "invalid_credentials" },
    { status: 429 },
    { code: "over_email_send_rate_limit" },
    { code: "email_address_not_authorized" },
    { code: "email_provider_disabled" },
    { code: "signup_disabled" },
    { code: "user_not_found" },
    { status: 500 },
  ];
  assert.equal(
    emailAuthError({ code: "user_not_found" }),
    emailAuthError({ status: 500 }),
  );
  for (const error of errors) {
    const message = emailAuthError(error);
    for (const locale of locales) {
      const catalog = JSON.parse(
        readFileSync(
          new URL(`../messages/${locale}.json`, import.meta.url),
          "utf8",
        ),
      );
      assert.ok(catalog.ui[messageKey(message)], `${locale}: ${message}`);
    }
  }
});

test("legacy password routes no longer expose password authentication", () => {
  // They are permanent redirects in next.config.ts (tests/hardening.test.mjs checks the redirect rules), so no page
  // is left to render.
  for (const route of ["forgot-password", "reset-password", "verify-email"])
    assert.ok(!existsSync(`app/${route}`), `app/${route} should not exist`);
  const screen = readFileSync("components/auth-screen.tsx", "utf8");
  assert.doesNotMatch(
    screen,
    /signInWithPassword|type="password"|resetPasswordForEmail|auth\.signUp/,
  );
  assert.match(screen, /isComposing/);
  assert.match(screen, /keyCode === 229/);
  assert.match(screen, /autoComplete="one-time-code"/);
  assert.match(screen, /pattern=\{emailCodeInputPattern\}/);
  assert.match(screen, /minLength=\{emailCodeMinLength\}/);
  assert.match(screen, /normalizeEmailCode\(event\.target\.value\)/);
  assert.doesNotMatch(screen, /6-digit|maxLength=\{6\}|slice\(0,\s*6\)/);
});

test("email links accept only a well-formed token hash and sign-in types", () => {
  const hash = "a".repeat(56);
  const parse = (query) => parseEmailLink(new URLSearchParams(query));
  assert.deepEqual(parse(`token_hash=${hash}&type=email`), {
    token_hash: hash,
    type: "email",
  });
  assert.deepEqual(parse(`token_hash=pkce_${hash}`), {
    token_hash: `pkce_${hash}`,
    type: "email",
  });
  for (const type of ["magiclink", "signup"])
    assert.equal(parse(`token_hash=${hash}&type=${type}`)?.type, type);
  for (const query of [
    "",
    "type=email",
    "token_hash=short&type=email",
    `token_hash=${hash}%0A&type=email`,
    `token_hash=${hash}&type=recovery`,
    `token_hash=${hash}&type=invite`,
    `token_hash=${hash}&type=email_change`,
    `token_hash=${"a".repeat(129)}&type=email`,
  ])
    assert.equal(parse(query), null, query);
});

test("email link verification submits only the token hash and type", async () => {
  let input;
  const result = { data: { session: null }, error: { code: "otp_expired" } };
  const client = {
    auth: {
      verifyOtp: async (value) => {
        input = value;
        return result;
      },
    },
  };
  const link = { token_hash: "b".repeat(56), type: "email" };
  assert.equal(await verifyEmailLink(client, link), result);
  assert.deepEqual(input, link);
  assert.throws(() =>
    verifyEmailLink(client, { token_hash: "bad", type: "email" }),
  );
});

test("sign-in and sign-up email templates carry the confirm link and the code", () => {
  for (const name of ["magic-link", "confirm-signup"]) {
    const html = readFileSync(`supabase/templates/${name}.html`, "utf8");
    assert.match(
      html,
      /href="\{\{ \.SiteURL \}\}\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=email"/,
      name,
    );
    assert.match(html, /\{\{ \.Token \}\}/, name);
    assert.match(html, /\{\{ \.SiteURL \}\}\/email\/logo\.png/, name);
    assert.doesNotMatch(html, /\{\{ \.ConfirmationURL \}\}/, name);
  }
});

test("email links are read from submitted form data the same way", () => {
  const form = new FormData();
  form.set("token_hash", "c".repeat(56));
  form.set("type", "signup");
  assert.deepEqual(parseEmailLink(form), {
    token_hash: "c".repeat(56),
    type: "signup",
  });
  const file = new FormData();
  file.set("token_hash", new Blob(["c".repeat(56)]));
  assert.equal(parseEmailLink(file), null);
});

test("opening the confirm link never signs in; only the submitted form does", () => {
  assert.equal(existsSync("app/auth/confirm/route.ts"), false);
  const page = readFileSync("app/auth/confirm/page.tsx", "utf8");
  assert.doesNotMatch(page, /verifyEmailLink|verifyOtp|createClient/);
  assert.match(page, /parseEmailLink/);
  assert.match(page, /referrer: "same-origin"/);
  assert.match(page, /index: false/);
  const action = readFileSync("app/auth/confirm/actions.ts", "utf8");
  assert.match(action, /^"use server";/);
  assert.match(action, /verifyEmailLink/);
  assert.match(action, /safeReturnPath/);
  // The form is server-rendered so it also submits without JavaScript.
  assert.match(page, /<form action=\{confirmEmailLink\}/);
  assert.doesNotMatch(page, /^"use client"/);
  assert.doesNotMatch(page, /requestSubmit|\.submit\(|autoFocus/);
  const button = readFileSync("components/confirm-continue-button.tsx", "utf8");
  assert.match(button, /useFormStatus/);
});
