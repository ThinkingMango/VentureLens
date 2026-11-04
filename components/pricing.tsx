"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import Link from "next/link";
import { Check, ArrowRight, CreditCard } from "lucide-react";
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
              ? "relative flex flex-col border-primary"
              : "relative flex flex-col"
          }
        >
          <CardHeader className="gap-3">
            {p.popular && (
              <Badge className="mb-1 w-fit rounded-md">
                {copy("Ongoing exploration")}
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
                toast.info(copy("Illustrative package only"), {
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
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-16 md:px-8 md:py-20">
        <div className="flex flex-col items-center gap-5 text-center">
          <h1 className="text-balance text-4xl font-semibold md:text-5xl">
            {copy("Invest in a clearer starting point.")}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {copy(
              "A focused sprint or a regular research habit. Choose the pace that works for your next chapter.",
            )}
          </p>
          <Badge variant="secondary">
            {copy("Illustrative pricing · Checkout is not connected")}
          </Badge>
        </div>
        <PricingCards />
        <div className="flex justify-center gap-2 text-center text-sm text-muted-foreground">
          <CreditCard className="size-4 shrink-0" />
          {copy(
            "All prices are synthetic package examples in USD. No payments are accepted.",
          )}
        </div>
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
          ].map((f) => (
            <details key={f.q} className="rounded-lg border p-5">
              <summary className="cursor-pointer font-medium">
                {copy(f.q)}
              </summary>
              <p className="mt-3 text-muted-foreground">{copy(f.a)}</p>
            </details>
          ))}
        </section>
        <div className="text-center">
          <Button asChild variant="outline">
            <Link href="/demo/dashboard">
              {copy("Try the demo workspace")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </main>
    </PublicShell>
  );
}
