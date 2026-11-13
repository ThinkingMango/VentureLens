import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SIGNUP_SOURCE_KEY, type SignupSource } from "./signup-source.ts";

export const emailSchema = z.string().trim().max(254).pipe(z.email());
export const emailCodeMinLength = 6;
export const emailCodeMaxLength = 10;
export const emailCodeInputPattern = `[0-9]{${emailCodeMinLength},${emailCodeMaxLength}}`;

export function normalizeEmailCode(value: string) {
  return value.normalize("NFKC").replace(/[\s-]/g, "");
}

export const emailCodeSchema = z
  .string()
  .transform(normalizeEmailCode)
  .pipe(z.string().regex(new RegExp(`^${emailCodeInputPattern}$`)));
export const emailCodeResendSeconds = 60;

export function emailAuthError(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code?.includes("rate_limit"))
    return "Too many attempts. Please wait a few minutes before trying again.";
  if (
    error.code === "otp_expired" ||
    error.code === "otp_disabled" ||
    error.code === "invalid_credentials"
  )
    return "That code is invalid or expired. Try again or request a new code.";
  if (error.code === "email_address_not_authorized")
    return "Email delivery is not configured for this address. Please contact support.";
  if (
    error.code === "email_provider_disabled" ||
    error.code === "signup_disabled"
  )
    return "Email sign-in is temporarily unavailable. Please contact support.";
  return "Authentication is temporarily unavailable. Please try again.";
}

/**
 * Sends the sign-in code and link. `source` is the call to action that led here (lib/signup-source.ts); Supabase stores
 * it as account metadata only when this request creates the account, so a returning founder's login never changes it.
 */
export function requestEmailCode(
  client: Pick<SupabaseClient, "auth">,
  email: string,
  redirect: string,
  source: SignupSource | null = null,
) {
  return client.auth.signInWithOtp({
    email: emailSchema.parse(email),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirect,
      ...(source ? { data: { [SIGNUP_SOURCE_KEY]: source } } : {}),
    },
  });
}

export function verifyEmailCode(
  client: Pick<SupabaseClient, "auth">,
  email: string,
  code: string,
) {
  return client.auth.verifyOtp({
    email: emailSchema.parse(email),
    token: emailCodeSchema.parse(code),
    type: "email",
  });
}

// Email-link sign-in: the templates link to /auth/confirm with {{ .TokenHash }}.
// The page there only verifies after the founder submits its form, so mail
// scanners that open links do not use up the one-time token.
export const emailLinkTypes = ["email", "magiclink", "signup"] as const;
export const emailLinkSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  type: z.enum(emailLinkTypes).default("email"),
});
export type EmailLink = z.infer<typeof emailLinkSchema>;

export function parseEmailLink(
  params: Pick<URLSearchParams | FormData, "get">,
): EmailLink | null {
  const value = (name: string) => {
    const entry = params.get(name);
    return typeof entry === "string" ? entry : undefined;
  };
  const parsed = emailLinkSchema.safeParse({
    token_hash: value("token_hash"),
    type: value("type"),
  });
  return parsed.success ? parsed.data : null;
}

export function verifyEmailLink(
  client: Pick<SupabaseClient, "auth">,
  link: EmailLink,
) {
  return client.auth.verifyOtp(emailLinkSchema.parse(link));
}
