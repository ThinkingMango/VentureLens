"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "@/components/workspace-link";
import { ArrowUpRight, CreditCard, Telescope } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanTable } from "@/components/pricing";
import { useDemo } from "@/components/demo-provider";
import { ResearchAccessCard } from "@/components/research-access-card";
import { progressFill } from "@/lib/utils";
export function Billing() {
  const copy = useCopy();
  const { isDemo } = useDemo();
  if (!isDemo)
    return (
      <>
        <PageHeader
          title={copy("Credits & billing")}
          description={copy("Paid research credits are not available yet.")}
        />
        <section className="surface flex flex-col gap-4 p-6">
          <h2 className="text-xl font-semibold">{copy("Your research runs")}</h2>
          {/* The same allowance the sidebar and New research page show, so billing never contradicts them. */}
          <ResearchAccessCard />
        </section>
        <section className="surface flex flex-col gap-4 p-6">
          <h2 className="text-xl font-semibold">
            {copy("No billing service connected")}
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            {copy(
              "Paid credits, charges, subscriptions, and payment methods are not connected yet, so nothing on this page can charge you. You can save research briefs without making a payment.",
            )}
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/research/new">
              {copy("Create a research brief")}
              <ArrowUpRight />
            </Link>
          </Button>
        </section>
      </>
    );
  const disconnected = () =>
    toast.info(copy("Live billing is not connected"), {
      description: copy(
        "Stripe is not configured. No payment details, invoices, charges, or subscriptions are available.",
      ),
    });
  return (
    <>
      <PageHeader
        title={copy("A clear view of your credits.")}
        description={copy(
          "Your research capacity, plan, and billing—all in one place.",
        )}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <section className="surface flex flex-col gap-5 p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">{copy("Research credits")}</h2>
            <Telescope className="size-5 text-primary" />
          </div>
          <p>
            <span className="text-4xl font-semibold tracking-tight">8</span>
            <span className="ml-2 text-muted-foreground">
              {copy("of 10 demo credits available")}
            </span>
          </p>
          <div className="progress-track">
            <div className="progress-fill" style={progressFill(80)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {copy(
              "2 used · Fixed synthetic balance. Demo research runs do not consume credits.",
            )}
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/research/new">
              {copy("Start a demo exploration")}
              <ArrowUpRight />
            </Link>
          </Button>
        </section>
        <section className="surface flex flex-col gap-5 p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">{copy("Current plan")}</h2>
            <Badge variant="secondary">{copy("Demo account")}</Badge>
          </div>
          <h3 className="text-2xl font-semibold">{copy("Explorer preview")}</h3>
          <p className="text-muted-foreground">
            {copy(
              "No active subscription. No payment method on file. No upcoming charges.",
            )}
          </p>
          <div className="mt-auto">
            <Button variant="outline" onClick={disconnected}>
              <CreditCard />
              {copy("About billing management")}
            </Button>
          </div>
        </section>
      </div>
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold">
            {copy("Choose your research pace")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {copy(
              "Illustrative packages in USD. Checkout and subscriptions are not connected.",
            )}
          </p>
        </div>
        <PlanTable bleed={false} />
      </section>
      <section className="surface overflow-hidden">
        <h2 className="border-b px-6 py-5 text-lg font-semibold">
          {copy("Example credit activity")}
        </h2>
        <div
          className="overflow-x-auto"
          role="region"
          tabIndex={0}
          aria-label={copy("Example credit activity")}
        >
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-background text-sm text-muted-foreground">
              <tr>
                {["Activity", "Type", "Credits", "Status"].map((t) => (
                  <th scope="col" key={t} className="px-6 py-3 font-medium">
                    {copy(t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Demo opening balance", "Example allocation", "+10"],
                ["Service business exploration", "Sample research", "−1"],
                ["Small team software research", "Sample research", "−1"],
              ].map(([a, t, c]) => (
                <tr className="border-t" key={a}>
                  <td className="px-6 py-4 font-medium">{copy(a)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{copy(t)}</td>
                  <td className="px-6 py-4 tabular-nums">{c}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">{copy("Synthetic")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">
            {copy("Invoices & payment methods")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy(
              "There are no real invoices or payment details in this demonstration.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={disconnected}>
          {copy("Billing service status")}
          <ArrowUpRight />
        </Button>
      </section>
      <DemoNote />
    </>
  );
}
