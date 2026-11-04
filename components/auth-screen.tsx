"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Check } from "lucide-react";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
export function AuthScreen({ signup = false }: { signup?: boolean }) {
  const [message, setMessage] = useState(false);
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
          <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
            Authentication preview only. Supabase is not connected. Don’t enter
            real credentials.
          </div>
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(true);
            }}
          >
            <FieldGroup>
              {signup && (
                <Field>
                  <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                  <Input
                    id="full-name"
                    required
                    placeholder="Demo founder"
                    autoComplete="off"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="alex@example.com"
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  required
                  placeholder="At least 8 characters"
                  autoComplete="off"
                />
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg">
              {signup ? "Preview sign up" : "Preview log in"}
              <ArrowRight />
            </Button>
            {message && (
              <p
                role="status"
                className="rounded-lg bg-secondary p-4 text-primary"
              >
                No credentials were sent or stored. Live{" "}
                {signup ? "account creation" : "login"} is not connected. Use
                the demo workspace below.
              </p>
            )}
          </form>
          <Button variant="outline" asChild>
            <Link href={signup ? "/onboarding" : "/dashboard"}>
              Continue to the demo
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
          Frontend demonstration · No account is created.
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
          ].map((t) => (
            <li className="flex items-center gap-3" key={t}>
              <Check className="size-4 text-primary" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
