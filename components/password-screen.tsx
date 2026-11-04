"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export function PasswordScreen({
  mode,
}: {
  mode: "recover" | "reset" | "verify";
}) {
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => setReady(true), []);
  const title =
    mode === "reset"
      ? "Choose a new password."
      : mode === "verify"
        ? "Confirm your email."
        : "Forgot your password?";
  async function submit(form: HTMLFormElement) {
    setPending(true);
    setError("");
    setMessage("");
    const values = new FormData(form);
    try {
      const supabase = createClient();
      if (mode === "reset") {
        const password = String(values.get("password") ?? "");
        if (
          password.length < 8 ||
          password.length > 128 ||
          password !== values.get("confirm")
        ) {
          setError("Use 8–128 characters and make sure both passwords match.");
          return;
        }
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();
        if (sessionError || !user) {
          setError(
            "Your recovery session has expired. Request a new password-reset link.",
          );
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setError(
            error.code === "same_password"
              ? "Choose a different password from your current password."
              : error.code === "weak_password"
                ? "Please choose a stronger password."
                : "Your password could not be updated. Request a new link or try again.",
          );
          return;
        }
        const { error: logoutError } = await supabase.auth.signOut({
          scope: "global",
        });
        if (logoutError) {
          setError(
            "Your password was updated, but existing sessions could not be signed out. Log out from your workspace and log in again.",
          );
          return;
        }
        router.replace("/login?notice=password-updated");
        router.refresh();
      } else {
        const email = String(values.get("email") ?? "").trim();
        const redirect = new URL(
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        );
        if (mode === "recover")
          redirect.searchParams.set("next", "/reset-password");
        const result =
          mode === "recover"
            ? await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirect.toString(),
              })
            : await supabase.auth.resend({
                type: "signup",
                email,
                options: { emailRedirectTo: redirect.toString() },
              });
        if (result.error?.status === 429) {
          setError(
            "Too many requests. Please wait a few minutes and try again.",
          );
          return;
        }
        if (result.error && result.error.status && result.error.status >= 500) {
          setError(
            "Email delivery is temporarily unavailable. Please try again shortly.",
          );
          return;
        }
        setMessage(
          mode === "recover"
            ? "If an account exists for this address, a password-reset link is on its way. Check your inbox and spam folder."
            : "If this address needs verification, a confirmation email is on its way. Check your inbox and spam folder.",
        );
      }
    } catch {
      setError(
        "This service is temporarily unavailable. Please try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-10 px-6 py-10">
      <Brand />
      <section className="surface flex flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-3xl font-semibold text-balance">{title}</h1>
        <p className="text-muted-foreground">
          {mode === "reset"
            ? "Update your password, then log in again. Existing sessions will be signed out."
            : mode === "verify"
              ? "Request a fresh confirmation link to activate your account."
              : "We’ll send you a link to securely reset your password."}
        </p>
        <form
          className="flex flex-col gap-6"
          data-ready={ready}
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) void submit(event.currentTarget);
          }}
        >
          <FieldGroup>
            {mode === "reset" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={pending}
                  />
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="recovery-email">Email address</FieldLabel>
                <Input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={pending}
                />
              </Field>
            )}
          </FieldGroup>
          <Button
            type="submit"
            disabled={pending || !ready}
            aria-busy={pending}
          >
            {pending
              ? "Please wait…"
              : mode === "reset"
                ? "Update password"
                : mode === "verify"
                  ? "Resend confirmation email"
                  : "Send reset link"}
          </Button>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
          )}
        </form>
        <Link className="text-sm font-medium text-primary" href="/login">
          Back to log in
        </Link>
      </section>
    </main>
  );
}
