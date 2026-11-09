import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Shell } from "@/components/shell";
import { Button, Chip, Eyebrow, TextLink, buttonClass } from "@/components/ui";
import { isoWeek, openTask, pickMove, staleCount, STALE_DAYS } from "@/lib/model";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/desk")({ component: DeskPage });

function DeskPage() {
  const profile = useDesk((s) => s.profile);
  const opportunities = useDesk((s) => s.opportunities);
  const checkins = useDesk((s) => s.checkins);
  const addCheckin = useDesk((s) => s.addCheckin);
  const week = isoWeek();
  const done = checkins.some((c) => c.week === week);
  const move = useMemo(() => pickMove(opportunities), [opportunities]);
  const aging = staleCount(opportunities);
  const saved = opportunities.filter((o) => o.saved && o.status !== "killed");

  return (
    <Shell>
      <div className="rise flex flex-col gap-6">
        <header>
          <Eyebrow>This week</Eyebrow>
          <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight md:text-5xl">
            {move ? headline(move.kind, move.opp.title) : "Nothing left in testing."}
          </h1>
          <p className="mt-3 text-muted">
            {profile.name.split(" ")[0]}, the report is not the job. The job is the next conversation.
          </p>
        </header>

        {move && !done ? (
          <section className="rounded-xl border border-line p-4">
            <h2 className="font-display text-2xl">Still testing this?</h2>
            <p className="mt-1 text-sm text-muted">One tap. It is the reason to come back.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                onClick={() =>
                  addCheckin({ week, opportunityId: move.opp.id, stance: "still" })
                }
              >
                Still
              </Button>
              <Button
                variant="quiet"
                onClick={() =>
                  addCheckin({ week, opportunityId: move.opp.id, stance: "paused" })
                }
              >
                Pause
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  addCheckin({ week, opportunityId: move.opp.id, stance: "killed" })
                }
              >
                Kill
              </Button>
            </div>
          </section>
        ) : null}

        {done ? (
          <p className="text-sm text-muted">
            Logged for {week}. Come back when the next conversation is done, or when a source goes stale.
          </p>
        ) : null}

        {move ? (
          <section className="rounded-xl border border-line bg-card p-4">
            <p className="text-sm text-faint">The question</p>
            <p className="mt-2 font-display text-2xl leading-snug tracking-tight">
              “{move.opp.question}”
            </p>
            <p className="mt-3 text-sm text-muted">{move.opp.falsify}</p>
            {openTask(move.opp) ? (
              <p className="mt-4 border-t border-line pt-4 text-sm">
                <span className="text-faint">Open task · </span>
                {openTask(move.opp)?.label}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/opportunities/$id"
                params={{ id: move.opp.id }}
                hash="log"
                className={buttonClass()}
              >
                Log a conversation
              </Link>
              <Link
                to="/opportunities/$id"
                params={{ id: move.opp.id }}
                className={buttonClass("quiet")}
              >
                Open the bet
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-line bg-card p-4">
            <p>Every saved bet is killed. Start from the research, or write a new brief.</p>
            <TextLink to="/brief" className="mt-4">
              New brief
            </TextLink>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/research"
            className="rounded-xl border border-line bg-card p-4"
          >
            <p className="text-sm text-faint">Evidence age</p>
            <p className="mt-2 font-display text-3xl tabular-nums">
              {aging}
              <span className="ml-2 font-sans text-base text-muted">
                older than {STALE_DAYS} days
              </span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {aging > 0
                ? "Re-read those excerpts before you pitch from them."
                : "Nothing in the short sample is stale."}
            </p>
          </Link>
          <Link to="/shortlist" className="rounded-xl border border-line bg-card p-4">
            <p className="text-sm text-faint">Still alive</p>
            <p className="mt-2 font-display text-3xl tabular-nums">{saved.length}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {saved.map((o) => (
                <Chip key={o.id} tone={o.status === "paused" ? "warn" : "neutral"}>
                  {o.score} · {o.title.split(" ").slice(0, 2).join(" ")}
                </Chip>
              ))}
              {saved.length === 0 ? <span className="text-sm text-muted">Shortlist is empty.</span> : null}
            </div>
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function headline(kind: "testing" | "paused" | "unsaved", title: string) {
  if (kind === "paused") return `You paused ${title}.`;
  if (kind === "unsaved") return `Pick up ${title}, or leave it.`;
  return `Ask about ${title}.`;
}
