"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Check, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "@/lib/workspace-schema";

function authError(code: string | undefined, status: number | undefined) {
  if (code === "email_not_confirmed")
    return "Please confirm your email before logging in. Check your inbox and spam folder.";
  if (code === "weak_password")
    return "Choose a stronger password with at least 8 characters.";
  if (status === 429 || code?.includes("rate_limit"))
    return "Too many attempts. Please wait a few minutes before trying again.";
  if (code === "email_address_not_authorized")
    return "Email delivery is not configured for this address. Please contact support.";
  if (code === "invalid_credentials" || code === "user_not_found")
    return "Invalid email or password.";
  return "Authentication is temporarily unavailable. Please try again.";
}
export function AuthScreen({ signup = false }: { signup?: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setReady(true);
    const notice = new URLSearchParams(window.location.search).get("notice");
    if (notice === "password-updated")
      setMessage(
        "Your password was updated. Please log in with your new password.",
      );
    if (notice === "callback")
      setError(
        "This email link is invalid or expired. Request a fresh confirmation or password-reset link.",
      );
    if (notice === "configuration")
      setError(
        "Authentication configuration is temporarily unavailable. Please try again shortly.",
      );
  }, []);
  async function submit(form: HTMLFormElement) {
    setPending(true);
    setError("");
    setMessage("");
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const name = String(values.get("name") ?? "").trim();
    if (
      !z.email().safeParse(email).success ||
      password.length < (signup ? 8 : 1) ||
      password.length > 128 ||
      (signup && (!name || name.length > 80))
    ) {
      setError("Enter a valid email, name, and password.");
      setPending(false);
      return;
    }
    try {
      const supabase = createClient();
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          if (
            error.code === "user_already_exists" ||
            error.code === "email_exists"
          ) {
            setMessage(
              "If this address can be registered, a confirmation email is on its way. Check your inbox, or log in if you already have an account.",
            );
          } else setError(authError(error.code, error.status));
        } else if (data.session) {
          router.replace("/onboarding");
          router.refresh();
        } else {
          form.reset();
          setMessage(
            "If this address can be registered, a confirmation email is on its way. Confirm your email before logging in. Check your spam folder too.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setError(authError(error.code, error.status));
        else {
          const next = safeReturnPath(
            new URLSearchParams(window.location.search).get("next"),
          );
          router.replace(next);
          router.refresh();
        }
      }
    } catch {
      setError(
        "Authentication is temporarily unavailable. Please try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-10 bg-card p-6 sm:p-12">
        <Brand />
        <div className="mx-auto flex w-full max-w-sm flex-col gap-7">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold">
              {signup ? "A new chapter starts here." : "Welcome back."}
            </h1>
            <p className="text-muted-foreground">
              {signup
                ? "Build a clearer picture of what you could build."
                : "A clearer view of your next opportunity awaits."}
            </p>
          </div>
          <form
            className="flex flex-col gap-6"
            data-ready={ready}
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending) void submit(event.currentTarget);
            }}
          >
            <FieldGroup>
              {signup && (
                <Field>
                  <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                  <Input
                    id="full-name"
                    name="name"
                    required
                    maxLength={80}
                    placeholder="Your name"
                    autoComplete="name"
                    disabled={pending}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  placeholder="you@company.com"
                  autoComplete="email"
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={signup ? 8 : 1}
                  maxLength={128}
                  required
                  placeholder={
                    signup ? "At least 8 characters" : "Your password"
                  }
                  autoComplete={signup ? "new-password" : "current-password"}
                  disabled={pending}
                />
              </Field>
            </FieldGroup>
            <Button
              type="submit"
              size="lg"
              disabled={pending || !ready}
              aria-busy={pending}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              {pending ? "Please wait…" : signup ? "Create account" : "Log in"}
            </Button>
            {error && (
              <p
                role="alert"
                className="rounded-lg border p-4 text-sm text-foreground"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-lg bg-secondary p-4 text-sm text-foreground"
              >
                {message}
              </p>
            )}
          </form>
          {!signup && (
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary"
            >
              Forgot your password?
            </Link>
          )}
          <Link
            href="/verify-email"
            className="text-sm font-medium text-primary"
          >
            Resend confirmation email
          </Link>
          <Button variant="outline" asChild>
            <Link href="/demo/dashboard">
              Explore the demo
              <ArrowRight />
            </Link>
          </Button>
          <p className="text-center text-muted-foreground">
            {signup ? "Already have an account?" : "New to VentureLens?"}{" "}
            <Link
              href={signup ? "/login" : "/signup"}
              className="font-medium text-primary"
            >
              {signup ? "Log in" : "Get started"}
            </Link>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Secure authentication · Your workspace stays private.
        </p>
      </section>
      <section className="hidden flex-col justify-center gap-8 bg-secondary p-16 lg:flex">
        <ShieldCheck className="size-12 text-primary" strokeWidth={1.3} />
        <h2 className="max-w-md text-4xl font-semibold leading-tight">
          The next great business
          <br />
          might be the right one
          <br />
          for you.
        </h2>
        <p className="max-w-md text-base text-muted-foreground">
          Start with your experience. Follow the evidence. Build conviction one
          conversation at a time.
        </p>
        <ul className="flex flex-col gap-4">
          {[
            "Opportunities aligned with your strengths",
            "Structured research, not a wall of chat",
            "A practical path to customer validation",
          ].map((text) => (
            <li className="flex items-center gap-3" key={text}>
              <Check className="size-4 text-primary" />
              {text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
