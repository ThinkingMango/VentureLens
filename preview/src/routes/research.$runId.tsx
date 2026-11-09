import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { OppCard } from "@/components/cards";
import { Shell } from "@/components/shell";
import { Button, Eyebrow } from "@/components/ui";
import { capitalLabel } from "@/lib/model";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/research/$runId")({ component: RunPage });

const stages = [
  "Reading the brief",
  "Retrieving pages",
  "Checking independent domains",
  "Arguing against what remains",
];

function RunPage() {
  const { runId } = Route.useParams();
  const run = useDesk((s) => s.runs.find((r) => r.id === runId));
  const opportunities = useDesk((s) => s.opportunities);
  const profile = useDesk((s) => s.profile);
  const [phase, setPhase] = useState<"check" | "play" | "done">("check");
  const [step, setStep] = useState(0);

  useEffect(() => {
    const fresh = sessionStorage.getItem("vl-fresh") === runId;
    if (fresh) sessionStorage.removeItem("vl-fresh");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(fresh && !reduce ? "play" : "done");
  }, [runId]);

  useEffect(() => {
    if (phase !== "play") return;
    if (step >= stages.length) {
      const t = window.setTimeout(() => setPhase("done"), 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setStep((n) => n + 1), 700);
    return () => window.clearTimeout(t);
  }, [phase, step]);

  if (phase === "check") {
    return (
      <Shell>
        <p className="text-muted">Opening the report.</p>
      </Shell>
    );
  }

  if (!run) {
    return (
      <Shell>
        <h1 className="font-display text-4xl">That run is not on this device.</h1>
        <Link to="/research" className="mt-4 inline-block text-accent">
          Back to research
        </Link>
      </Shell>
    );
  }

  const kept = run.opportunityIds
    .map((id) => opportunities.find((o) => o.id === id))
    .filter((o) => o != null)
    .sort((a, b) => b.score - a.score);

  return (
    <Shell>
      {phase === "play" ? (
        <div className="rise flex flex-col gap-6">
          <Eyebrow>Running the gate</Eyebrow>
          <h1 className="font-display text-4xl tracking-tight">{run.name}</h1>
          <ol className="flex flex-col gap-3">
            {stages.map((label, i) => (
              <li key={label} className="flex min-h-11 items-center gap-3 text-base">
                <span className="flex size-5 items-center justify-center" aria-hidden="true">
                  {i < step ? (
                    <Check className="size-4 text-accent" />
                  ) : (
                    <span className={i === step ? "text-ink" : "text-faint"}>{i + 1}</span>
                  )}
                </span>
                <span className={i > step ? "text-faint" : "text-ink"}>{label}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            Preview sequence. These pages are fixtures, so you can see the gate without a model call.
          </p>
          <Button variant="quiet" className="w-fit" onClick={() => setPhase("done")}>
            Show the report
          </Button>
        </div>
      ) : (
        <div className="rise flex flex-col gap-6">
          <header>
            <Eyebrow>Report</Eyebrow>
            <h1 className="mt-2 font-display text-4xl tracking-tight">{run.name}</h1>
            <p className="mt-3 text-sm text-muted">
              {run.brief.hours} hours a week · {capitalLabel(run.brief.capital)} · {run.brief.geography}
            </p>
            <p className="mt-2 text-sm text-faint">
              Sample evidence. Live VentureLens would have retrieved these pages, then dropped anything with a single source.
            </p>
          </header>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-2xl">Kept</h2>
            {kept.map((opp) => (
              <OppCard key={opp.id} opp={opp} profile={profile} />
            ))}
          </section>
          <section>
            <h2 className="font-display text-2xl">Dropped</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {run.dropped.map((item) => (
                <li key={item.title} className="rounded-xl border border-line bg-bad-bg p-4">
                  <p className="text-sm font-medium text-bad">No report</p>
                  <h3 className="mt-1 font-display text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm text-ink">{item.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Shell>
  );
}
