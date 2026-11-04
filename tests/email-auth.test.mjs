import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emailSchema,
  emailCodeSchema,
  emailCodeResendSeconds,
  emailAuthError,
  requestEmailCode,
  verifyEmailCode,
} from "../lib/email-auth.ts";
import { messageKey, locales } from "../i18n/config.ts";

test("email and code input are normalized and validated", () => {
  assert.equal(
    emailSchema.parse("  founder@company.com  "),
    "founder@company.com",
  );
  for (const email of ["", "not-an-email", "a".repeat(255) + "@company.com"])
    assert.equal(emailSchema.safeParse(email).success, false);
  assert.equal(emailCodeSchema.parse(" 012345 "), "012345");
  for (const code of [
    "",
    "12345",
    "1234567",
    "abcdef",
    "１２３４５６",
    "123 456",
  ])
    assert.equal(emailCodeSchema.safeParse(code).success, false);
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
  assert.equal(
    await verifyEmailCode(client, "founder@company.com", "012345"),
    result,
  );
  assert.deepEqual(input, {
    email: "founder@company.com",
    token: "012345",
    type: "email",
  });
  assert.throws(() => verifyEmailCode(client, "founder@company.com", "bad"));
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
  for (const route of ["forgot-password", "reset-password", "verify-email"])
    assert.match(
      readFileSync(`app/${route}/page.tsx`, "utf8"),
      /redirect\("\/login"\)/,
    );
  const screen = readFileSync("components/auth-screen.tsx", "utf8");
  assert.doesNotMatch(
    screen,
    /signInWithPassword|type="password"|resetPasswordForEmail|auth\.signUp/,
  );
  assert.match(screen, /isComposing/);
  assert.match(screen, /keyCode === 229/);
  assert.match(screen, /autoComplete="one-time-code"/);
});
