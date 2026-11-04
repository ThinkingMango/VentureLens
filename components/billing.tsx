"use client";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Telescope } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PricingCards } from "@/components/pricing";
export function Billing() {
  const disconnected = () =>
    toast.info("Live billing is not connected", {
      description:
        "Stripe is not configured. No payment details, invoices, charges, or subscriptions are available.",
    });
  return (
    <>
      <PageHeader
        title="A clear view of your credits."
        description="Your research capacity, plan, and billing—all in one place."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <section className="surface flex flex-col gap-5 p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Research credits</h2>
            <Telescope className="size-5 text-primary" />
          </div>
          <p>
            <span className="text-4xl font-semibold tracking-tight">8</span>
            <span className="ml-2 text-muted-foreground">
              of 10 demo credits available
            </span>
          </p>
          <div className="progress-track">
            <div className="progress-fill w-4/5" />
          </div>
          <p className="text-sm text-muted-foreground">
            2 used · Fixed synthetic balance. Demo research runs do not consume
            credits.
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/research/new">
              Start a demo exploration
              <ArrowUpRight />
            </Link>
          </Button>
        </section>
        <section className="surface flex flex-col gap-5 p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Current plan</h2>
            <Badge variant="secondary">Demo account</Badge>
          </div>
          <h3 className="text-2xl font-semibold">Explorer preview</h3>
          <p className="text-muted-foreground">
            No active subscription. No payment method on file. No upcoming
            charges.
          </p>
          <div className="mt-auto">
            <Button variant="outline" onClick={disconnected}>
              <CreditCard />
              About billing management
            </Button>
          </div>
        </section>
      </div>
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold">Choose your research pace</h2>
          <p className="mt-2 text-muted-foreground">
            Illustrative packages in USD. Checkout and subscriptions are not
            connected.
          </p>
        </div>
        <PricingCards />
      </section>
      <section className="surface overflow-hidden">
        <h2 className="border-b px-6 py-5 text-lg font-semibold">
          Example credit activity
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-background text-sm text-muted-foreground">
              <tr>
                {["Activity", "Type", "Credits", "Status"].map((t) => (
                  <th key={t} className="px-6 py-3 font-medium">
                    {t}
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
                  <td className="px-6 py-4 font-medium">{a}</td>
                  <td className="px-6 py-4 text-muted-foreground">{t}</td>
                  <td className="px-6 py-4 tabular-nums">{c}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">Synthetic</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">Invoices & payment methods</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no real invoices or payment details in this demonstration.
          </p>
        </div>
        <Button variant="outline" onClick={disconnected}>
          Billing service status
          <ArrowUpRight />
        </Button>
      </section>
      <DemoNote />
    </>
  );
}
