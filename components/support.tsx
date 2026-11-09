"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  LifeBuoy,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mailto, privacyEmail, supportEmail } from "@/lib/contact";

const include = [
  "The email address on your account",
  "The link to the research run or page where it happened",
  "What you expected, and what happened instead",
  "Any error message, ideally with a screenshot",
  "Your browser, device, and interface language",
];

const topics = [
  {
    title: "Signing in",
    questions: [
      {
        q: "I didn’t receive a sign-in email.",
        a: "Check your spam or promotions folder and confirm the address is spelled correctly. Emails usually arrive within a minute. You can request a new code once the countdown on the sign-in screen ends.",
      },
      {
        q: "My code or sign-in link doesn’t work.",
        a: "Codes and links expire and can be used only once, and using the button in an email also uses up its code. Request a new code and use the most recent email only.",
      },
    ],
  },
  {
    title: "Research",
    questions: [
      {
        q: "My free research run is missing.",
        a: "Every confirmed account receives one free research run. If yours does not appear on the New research page, log out and back in. If it is still missing, email support from the address on your account.",
      },
      {
        q: "My research run failed.",
        a: "If retrieval fails, the model output is rejected, or the evidence is too thin, the run stops and your run is returned automatically. Check its status in My research before starting again.",
      },
      {
        q: "Why did I get fewer opportunities than expected?",
        a: "An opportunity only enters the report when it is backed by independent evidence. When the evidence supports fewer candidates, the list is not padded.",
      },
    ],
  },
  {
    title: "Account and data",
    questions: [
      {
        q: "How do I change the interface language?",
        a: "Use the language menu at the top of any page. Source excerpts in reports stay in their original language.",
      },
      {
        q: "How do I export or delete my data?",
        a: "Email our privacy team from the address on your account and tell us what you need. We may confirm your identity first and aim to respond within 30 days.",
      },
      {
        q: "Will I be charged?",
        a: "No. Payments are not connected during the beta, and no purchase, subscription, or charge can be created.",
      },
    ],
  },
];

export function Support() {
  const copy = useCopy();
  return (
    <PublicShell>
      <main>
        <section className="hero-bg">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 pb-12 pt-16 text-center md:px-8 md:pt-20">
            <Badge variant="secondary" className="gap-1.5">
              <LifeBuoy className="size-3.5" />
              {copy("Support")}
            </Badge>
            <h1 className="text-balance text-4xl font-semibold md:text-5xl">
              {copy("How can we help?")}
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              {copy(
                "Questions about your account, a research run, or your data? Email us and a person on our team will reply. You can write in English or Chinese.",
              )}
            </p>
          </div>
        </section>
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 pb-20 md:px-8">
          <section
            aria-label={copy("Contact options")}
            className="grid gap-5 md:grid-cols-2"
          >
            <article className="surface flex flex-col gap-4 p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <LifeBuoy className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">{copy("Product support")}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {copy(
                    "Sign-in problems, research runs, reports, saved opportunities, or anything that isn’t working as expected. We aim to reply within two business days.",
                  )}
                </p>
              </div>
              <Button asChild className="mt-auto w-fit">
                <a href={mailto(supportEmail, "VentureLens support request")}>
                  <Mail />
                  {supportEmail}
                </a>
              </Button>
            </article>
            <article className="surface flex flex-col gap-4 p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">{copy("Privacy and data requests")}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {copy(
                    "Access, export, correct, or delete your personal information, or ask how we handle it. Please write from the email address on your account.",
                  )}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" className="w-fit">
                  <a href={mailto(privacyEmail, "VentureLens privacy request")}>
                    <Mail />
                    {privacyEmail}
                  </a>
                </Button>
                <Link
                  href="/privacy"
                  className="flex items-center gap-1 text-sm font-medium text-primary"
                >
                  {copy("Read the Privacy Policy")}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </article>
          </section>
          <section className="surface flex flex-col gap-4 p-6">
            <h2 className="text-xl font-semibold">
              {copy("Help us help you faster")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {copy("When you email support, include:")}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {include.map((text) => (
                <li key={text} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {copy(text)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {copy(
                "We will never ask for your sign-in code. Don’t share it with anyone, including us.",
              )}
            </p>
          </section>
          <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <h2 className="text-2xl font-semibold">
              {copy("Common questions")}
            </h2>
            {topics.map((topic) => (
              <div key={topic.title} className="flex flex-col gap-3">
                <h3 className="font-semibold text-muted-foreground">
                  {copy(topic.title)}
                </h3>
                {topic.questions.map((item) => (
                  <details key={item.q} className="surface group p-5">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                      {copy(item.q)}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {copy(item.a)}
                    </p>
                  </details>
                ))}
              </div>
            ))}
          </section>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/demo/dashboard">
                {copy("Try the demo workspace")}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">
                {copy("Pricing")}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
