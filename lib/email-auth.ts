import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const emailSchema = z.string().trim().max(254).pipe(z.email());
export const emailCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
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

export function requestEmailCode(
  client: Pick<SupabaseClient, "auth">,
  email: string,
  redirect: string,
) {
  return client.auth.signInWithOtp({
    email: emailSchema.parse(email),
    options: { shouldCreateUser: true, emailRedirectTo: redirect },
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
