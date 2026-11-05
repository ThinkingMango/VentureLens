"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import Link from "next/link";
import { Check, ArrowRight, ArrowUpRight, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
export const plans = [
  {
    name: "Opportunity Sprint",
    price: 29,
    period: "one-time",
    description: "For a focused first exploration.",
    credits: "5 research credits",
    perCredit: 5.8,
    features: [
      "Personalized founder profile",
      "Structured opportunity research",
      "Buyer, evidence & risk breakdowns",
      "Validation planning",
    ],
    popular: false,
  },
  {
    name: "Explorer",
    price: 39,
    period: "/ month",
    description: "For founders finding their direction.",
    credits: "10 research credits / month",
    perCredit: 3.9,
    features: [
      "Everything in Opportunity Sprint",
      "Ongoing opportunity exploration",
      "Save and compare opportunities",
      "Monthly credit refresh",
    ],
    popular: true,
  },
  {
    name: "Builder",
    price: 79,
    period: "/ month",
    description: "For a more active research practice.",
    credits: "30 research credits / month",
    perCredit: 2.63,
    features: [
      "Everything in Explorer",
      "More room to explore niches",
      "Expanded research capacity",
      "Priority support (planned)",
    ],
    popular: false,
  },
];
export function PricingCards() {
  const copy = useCopy();
  const format = useFormats();
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((p) => (
        <Card
          key={p.name}
          className={
            p.popular
              ? "relative flex flex-col border-primary ring-2 ring-primary/15"
              : "relative flex flex-col"
          }
        >
          <CardHeader className="gap-3">
            {p.popular && (
              <Badge className="mb-1 w-fit rounded-md">
                <Sparkles className="mr-1 size-3.5" />
                {copy("Most flexible")}
              </Badge>
            )}
            <CardTitle>{copy(p.name)}</CardTitle>
            <CardDescription>{copy(p.description)}</CardDescription>
            <p className="pt-3">
              <strong className="text-4xl font-semibold tracking-tight">
                {format.usd(p.price, 0)}
              </strong>
              <span className="ml-2 text-muted-foreground">
                {copy(p.period)}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {copy("About {amount} per research run", { amount: format.usd(p.perCredit, 2) })}
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            <p className="font-medium text-primary">{copy(p.credits)}</p>
            <ul className="flex flex-col gap-3">
              {p.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {copy(f)}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant={p.popular ? "default" : "outline"}
              className="w-full"
              onClick={() =>
                toast.info(copy("Planned package · Checkout opens after beta"), {
                  description: copy(
                    "Stripe is not connected. No purchase, subscription, or charge will be created.",
                  ),
                })
              }
            >
              {copy("Preview {plan}", { plan: copy(p.name) })}
              <ArrowRight />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
export function Pricing() {
  const copy = useCopy();
  return (
    <PublicShell>
      <main>
        <section className="hero-bg">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 pb-12 pt-16 text-center md:px-8 md:pt-20">
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              {copy("Planned pricing · No payments collected during beta")}
            </Badge>
            <h1 className="text-balance text-4xl font-semibold md:text-5xl">
              {copy("Invest in a clearer starting point.")}
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              {copy(
                "One credit is one full research run: discovery, web retrieval, classification, scoring, adversarial review, and a saved report. Pick a focused sprint or an ongoing research habit.",
              )}
            </p>
          </div>
        </section>
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 pb-20 md:px-8">
          <PricingCards />
          <section className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Failed runs do not cost a run",
                text: "If retrieval fails, the model output is rejected, or the evidence is too thin to support a report, the run stops and your run is returned automatically. The same rule will apply to paid credits.",
              },
              {
                title: "Your first run is free",
                text: "Every confirmed account receives one free research run, and the complete demo workspace needs no account or card.",
              },
              {
                title: "Prices may change before launch",
                text: "These packages are the working baseline while we measure real cost per completed report. Final prices, credit rollover, and refund terms will be published before checkout opens.",
              },
            ].map((item) => (
              <article key={item.title} className="surface flex flex-col gap-2 p-6">
                <h2 className="font-semibold">{copy(item.title)}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{copy(item.text)}</p>
              </article>
            ))}
          </section>
          <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            <h2 className="text-2xl font-semibold">
              {copy("A few things worth knowing")}
            </h2>
            {[
              {
                q: "What does a research credit cover?",
                a: "The planned model is one credit per standard research run. The demo does not consume credits or call a live research provider.",
              },
              {
                q: "Are the opportunities verified?",
                a: "Demo reports use synthetic data. Authorized development accounts can run evidence-driven research with original links and retrieval dates. Neither mode guarantees buyer demand; validate findings with customers.",
              },
              {
                q: "Can I cancel a subscription?",
                a: "Recurring packages are illustrative. Subscription creation, renewal, cancellation, invoices, and billing management will require a future Stripe integration.",
              },
              {
                q: "How do I get access to live research now?",
                a: "Create a free account and confirm your email. One research run is granted automatically and shown on the New research page; complete your founder profile and start a brief to use it.",
              },
            ].map((f) => (
              <details key={f.q} className="surface group p-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                  {copy(f.q)}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy(f.a)}</p>
              </details>
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
              <Link href="/signup">
                {copy("Create a free account")}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
