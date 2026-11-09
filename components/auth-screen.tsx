"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, Check, LoaderCircle } from "lucide-react";
import {
  emailSchema,
  emailCodeSchema,
  emailCodeMinLength,
  emailCodeInputPattern,
  normalizeEmailCode,
  emailCodeResendSeconds,
  emailAuthError,
  requestEmailCode,
  verifyEmailCode,
} from "@/lib/email-auth";
import { Brand } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "@/lib/workspace-schema";

export function AuthScreen() {
  const copy = useCopy();
  const feedbackId = useId();
  const helpId = useId();
  const codeInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    setReady(true);
    const notice = new URLSearchParams(window.location.search).get("notice");
    if (notice === "callback")
      setError(
        "This email link is invalid or expired. Request a new sign-in code.",
      );
    if (notice === "configuration")
      setError(
        "Authentication configuration is temporarily unavailable. Please try again shortly.",
      );
  }, []);
  useEffect(() => {
    if (!resendAt) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    if (step === "code" && !pending) codeInput.current?.focus();
  }, [step, pending]);

  async function sendCode() {
    if (busy.current || Date.now() < resendAt) return;
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const redirect = new URL(
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback`,
      );
      redirect.searchParams.set(
        "next",
        safeReturnPath(new URLSearchParams(window.location.search).get("next")),
      );
      const { error } = await requestEmailCode(
        createClient(),
        parsed.data,
        redirect.toString(),
      );
      if (error) {
        setError(emailAuthError(error));
        if (error.status === 429 || error.code?.includes("rate_limit"))
          setResendAt(Date.now() + emailCodeResendSeconds * 1000);
        return;
      }
      setEmail(parsed.data);
      setCode("");
      setStep("code");
      setResendAt(Date.now() + emailCodeResendSeconds * 1000);
      setMessage(
        "A sign-in code has been requested for {email}. Check your inbox and spam folder. Use the newest code.",
      );
    } catch {
      setError("Authentication is temporarily unavailable. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function verifyCode() {
    if (busy.current) return;
    if (!emailCodeSchema.safeParse(code).success) {
      setError("Enter the complete code from your email (6–10 digits).");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const { data, error } = await verifyEmailCode(
        createClient(),
        email,
        code,
      );
      if (error || !data.session) {
        setError(
          error
            ? emailAuthError(error)
            : "Authentication is temporarily unavailable. Please try again.",
        );
        return;
      }
      const next = safeReturnPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      window.location.replace(
        `/auth/callback?next=${encodeURIComponent(next)}`,
      );
    } catch {
      setError("Authentication is temporarily unavailable. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-10 bg-card p-6 sm:p-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Brand />
          <LanguageSwitcher />
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-7">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold text-balance">
              {step === "code"
                ? copy("Check your email.")
                : copy("Your next chapter starts here.")}
            </h1>
            <p className="text-muted-foreground text-pretty">
              {step === "code"
                ? copy("Enter the one-time code sent to {email}.", { email })
                : copy(
                    "Sign in or create an account with your email. No password needed.",
                  )}
            </p>
          </div>
          <form
            className="flex flex-col gap-6"
            data-ready={ready}
            noValidate
            aria-describedby={error || message ? feedbackId : undefined}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.nativeEvent.isComposing || event.keyCode === 229)
              )
                event.preventDefault();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending) void (step === "code" ? verifyCode() : sendCode());
            }}
          >
            <FieldGroup>
              {step === "email" ? (
                <Field data-disabled={pending} data-invalid={!!error}>
                  <FieldLabel htmlFor="email">
                    {copy("Email address")}
                  </FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder={copy("you@company.com")}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    disabled={pending}
                    aria-invalid={!!error}
                    aria-describedby={error ? feedbackId : undefined}
                  />
                </Field>
              ) : (
                <Field data-disabled={pending} data-invalid={!!error}>
                  <FieldLabel htmlFor="email-code">
                    {copy("Verification code")}
                  </FieldLabel>
                  <Input
                    ref={codeInput}
                    id="email-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern={emailCodeInputPattern}
                    minLength={emailCodeMinLength}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={code}
                    onChange={(event) => {
                      setCode(normalizeEmailCode(event.target.value));
                      setError("");
                    }}
                    disabled={pending}
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? `${helpId} ${feedbackId}` : helpId
                    }
                  />
                  <FieldDescription id={helpId}>
                    {copy(
                      "Enter every digit shown in your email. Codes expire and can only be used once. Never share your code.",
                    )}
                  </FieldDescription>
                </Field>
              )}
            </FieldGroup>
            <Button
              type="submit"
              size="lg"
              disabled={
                pending || !ready || (step === "email" && remaining > 0)
              }
              aria-busy={pending}
            >
              {pending ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <ArrowRight data-icon="inline-start" />
              )}
              {pending
                ? copy("Please wait…")
                : step === "code"
                  ? copy("Verify and continue")
                  : copy("Send sign-in code")}
            </Button>
            {error && (
              <p
                id={feedbackId}
                role="alert"
                className="rounded-lg border p-4 text-sm text-foreground"
              >
                {copy(error)}
              </p>
            )}
            {message && (
              <p
                id={feedbackId}
                role="status"
                className="rounded-lg bg-secondary p-4 text-sm text-foreground"
              >
                {copy(message, { email })}
              </p>
            )}
            {remaining > 0 && (
              <p className="text-sm text-muted-foreground">
                {copy("You can request another code in {seconds}s.", {
                  seconds: remaining,
                })}
              </p>
            )}
            {step === "code" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || remaining > 0}
                  onClick={() => void sendCode()}
                >
                  {copy("Resend code")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                    setMessage("");
                  }}
                >
                  {copy("Use a different email")}
                </Button>
              </div>
            )}
          </form>
          <Button variant="outline" asChild>
            <Link href="/demo/dashboard">
              {copy("Explore the demo")}
              <ArrowRight />
            </Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {copy(
              "One email, one code. The same simple flow for new and returning users.",
            )}
          </p>
          <p className="rounded-lg bg-secondary p-3 text-center text-sm text-foreground">
            {copy("One free research run on sign-up. No card, no subscription, nothing to cancel.")}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {copy("By continuing, you acknowledge how we handle your information:")}{" "}
            <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
              {copy("Privacy Policy")}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <p>{copy("Secure authentication · Your workspace stays private.")}</p>
          <nav aria-label={copy("Legal and help")} className="flex gap-4">
            <Link href="/privacy" className="hover:text-primary">
              {copy("Privacy Policy")}
            </Link>
            <Link href="/support" className="hover:text-primary">
              {copy("Support")}
            </Link>
          </nav>
        </div>
      </section>
      <section className="band-dark relative hidden flex-col justify-center gap-10 overflow-hidden p-16 lg:flex">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative flex flex-col gap-6">
          <ShieldCheck className="size-12 text-[#9fb7ff]" strokeWidth={1.3} />
          <h2 className="max-w-md text-4xl font-semibold leading-tight">
            {copy("The next great business")}
            <br />
            {copy("might be the right one")}
            <br />
            {copy("for you.")}
          </h2>
          <p className="muted-on-dark max-w-md text-base">
            {copy(
              "Start with your experience. Follow the evidence. Build conviction one conversation at a time.",
            )}
          </p>
        </div>
        <ol className="relative flex max-w-md flex-col gap-4">
          {[
            ["Confirm your email", "One code, no password to remember."],
            ["Build your founder profile", "Four short questions about your skills, time, budget, and goals."],
            ["Explore and save opportunities", "Read sample reports, save a shortlist, and plan your first buyer conversations."],
          ].map(([title, text], index) => (
            <li key={title} className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold text-[#9fb7ff]">
                {index + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-medium">{copy(title)}</span>
                <span className="muted-on-dark text-sm">{copy(text)}</span>
              </span>
            </li>
          ))}
        </ol>
        <ul className="relative flex flex-col gap-3 text-sm">
          {[
            "Opportunities aligned with your strengths",
            "Structured research, not a wall of chat",
            "A practical path to customer validation",
          ].map((text) => (
            <li className="flex items-center gap-3" key={text}>
              <Check className="size-4 text-[#9fb7ff]" />
              {copy(text)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
