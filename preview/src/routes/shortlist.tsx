import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OppCard } from "@/components/cards";
import { Shell } from "@/components/shell";
import { Eyebrow, Meter, TextLink } from "@/components/ui";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/shortlist")({ component: ShortlistPage });

function ShortlistPage() {
  const opportunities = useDesk((s) => s.opportunities);
  const profile = useDesk((s) => s.profile);
  const saved = opportunities.filter((o) => o.saved && o.status !== "killed");
  const closed = opportunities.filter((o) => o.saved && o.status === "killed");
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    setPicked((curr) => {
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      if (curr.length >= 2) return [curr[1], id];
      return [...curr, id];
    });
  }

  const pair = picked
    .map((id) => opportunities.find((o) => o.id === id))
    .filter((o) => o != null);

  return (
    <Shell>
      <div className="rise flex flex-col gap-6">
        <header>
          <Eyebrow>Shortlist</Eyebrow>
          <h1 className="mt-2 font-display text-4xl tracking-tight">Bets you have not killed</h1>
          <p className="mt-2 text-muted">
            Compare two. The point is a choice, not a longer list.
          </p>
        </header>
        {saved.length === 0 && closed.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-4">
            <p>Nothing saved. Open a report and keep the one you will actually talk about.</p>
            <TextLink to="/research" variant="quiet" className="mt-4">
              Go to research
            </TextLink>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {saved.map((opp) => (
              <OppCard
                key={opp.id}
                opp={opp}
                profile={profile}
                compare
                selected={picked.includes(opp.id)}
                onCompare={() => toggle(opp.id)}
              />
            ))}
          </div>
        )}
        {closed.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-2xl">Closed</h2>
            {closed.map((opp) => (
              <OppCard key={opp.id} opp={opp} profile={profile} />
            ))}
          </section>
        ) : null}
        {pair.length === 2 ? (
          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="font-display text-2xl">Side by side</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {pair.map((opp) => (
                <p key={opp.id} className="font-medium">
                  {opp.title}
                  <span className="mt-1 block font-display text-3xl tabular-nums">{opp.score}</span>
                </p>
              ))}
            </div>
            <ul className="mt-4 flex flex-col gap-4">
              {pair[0].dimensions.map((dim, i) => (
                <li key={dim.id}>
                  <p className="text-sm text-muted">{dim.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-sm tabular-nums">{pair[0].dimensions[i].score}</p>
                      <Meter score={pair[0].dimensions[i].score} />
                    </div>
                    <div>
                      <p className="mb-1 text-sm tabular-nums">{pair[1].dimensions[i].score}</p>
                      <Meter score={pair[1].dimensions[i].score} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-faint">
              Same weights. Different evidence. Neither number is a chance of success.
            </p>
          </section>
        ) : saved.length >= 2 ? (
          <p className="text-sm text-muted">Choose two to compare.</p>
        ) : null}
      </div>
    </Shell>
  );
}
