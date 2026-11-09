import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Shell } from "@/components/shell";
import { Eyebrow, TextLink } from "@/components/ui";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/research")({ component: ResearchPage });

function ResearchPage() {
  const runs = useDesk((s) => s.runs);
  const opportunities = useDesk((s) => s.opportunities);

  return (
    <Shell>
      <div className="rise flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Research</Eyebrow>
            <h1 className="mt-2 font-display text-4xl tracking-tight">Your briefs</h1>
            <p className="mt-2 max-w-prose text-muted">
              A run is a snapshot of your constraints plus the bets that survived the evidence gate. Older reports stay as they were.
            </p>
          </div>
          <TextLink to="/brief">New brief</TextLink>
        </header>
        <ul className="flex flex-col gap-3">
          {runs.map((run) => {
            const kept = run.opportunityIds
              .map((id) => opportunities.find((o) => o.id === id))
              .filter((o) => o != null);
            const top = [...kept].sort((a, b) => b.score - a.score)[0];
            return (
              <li key={run.id}>
                <Link
                  to="/research/$runId"
                  params={{ runId: run.id }}
                  className="block rounded-xl border border-line bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-2xl leading-tight">{run.name}</h2>
                    <span className="shrink-0 text-sm text-faint">
                      {format(parseISO(run.createdAt), "d MMM yyyy")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {kept.length} kept · {run.dropped.length} dropped
                    {top ? ` · top score ${top.score}` : ""}
                  </p>
                  <p className="mt-3 text-sm text-faint">Sample evidence, shaped to the brief. Not a live retrieval.</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
