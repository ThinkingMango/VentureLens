import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Chip, Eyebrow, inputClass, Meter, ScoreMark } from "@/components/ui";
import { fitNotes, STALE_DAYS } from "@/lib/model";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/opportunities/$id")({ component: OppPage });

function OppPage() {
  const { id } = Route.useParams();
  const opp = useDesk((s) => s.opportunities.find((o) => o.id === id));
  const profile = useDesk((s) => s.profile);
  const toggleSaved = useDesk((s) => s.toggleSaved);
  const setStatus = useDesk((s) => s.setStatus);
  const toggleTask = useDesk((s) => s.toggleTask);
  const addInterview = useDesk((s) => s.addInterview);
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");

  if (!opp) {
    return (
      <Shell>
        <h1 className="font-display text-4xl">That bet is not on this device.</h1>
        <Link to="/research" className="mt-4 inline-block text-accent">
          Back to research
        </Link>
      </Shell>
    );
  }

  const notes = fitNotes(opp, profile);
  const deduction = opp.critique.reduce((n, c) => n + c.deduction, 0);

  return (
    <Shell>
      <article className="rise flex flex-col gap-8">
        <header>
          <Link to="/research" className="text-sm text-muted">
            Research
          </Link>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight">{opp.title}</h1>
          <p className="mt-3 text-muted">{opp.buyer}</p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <ScoreMark score={opp.score} size="lg" />
              <p className="mt-2 text-sm text-muted">{opp.confidence} evidence · not a probability</p>
            </div>
            <Chip tone={opp.status === "killed" ? "bad" : opp.status === "paused" ? "warn" : "good"}>
              {opp.status === "testing" ? "In testing" : opp.status === "paused" ? "Paused" : "Killed"}
            </Chip>
          </div>
          <p className="mt-4 text-sm text-faint">
            A supported score stops at 85. Review already took {deduction} points off and cannot add any back.
          </p>
        </header>

        <section className="rounded-xl border border-line bg-card p-4">
          <Eyebrow>The bet</Eyebrow>
          <p className="mt-3 text-lg">{opp.hypothesis}</p>
          <dl className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-faint">Pain</dt>
              <dd>{opp.pain}</dd>
            </div>
            <div>
              <dt className="text-faint">What they do now</dt>
              <dd>{opp.instead}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="font-display text-2xl">Fit, separate from the score</h2>
          <p className="mt-1 text-sm text-muted">
            Editing your profile changes these notes. It does not rewrite the researched number.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n} className="rounded-lg border border-line px-3 py-3 text-sm">
                {n}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl">Why the number</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {opp.dimensions.map((d) => (
              <li key={d.id}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>
                    {d.label}
                    <span className="text-faint"> · {d.weight}%</span>
                  </span>
                  <span className="tabular-nums">{d.score}</span>
                </div>
                <Meter score={d.score} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl">Sources</h2>
          <p className="mt-1 text-sm text-muted">Excerpts are fixtures. Live runs keep the original page and the retrieval date.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {opp.sources.map((s) => {
              const open = openSource === s.id;
              const stale = s.ageDays >= STALE_DAYS;
              return (
                <li key={s.id} className="rounded-lg border border-line bg-card">
                  <button
                    type="button"
                    className="flex w-full min-h-11 items-start justify-between gap-3 px-3 py-3 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenSource(open ? null : s.id)}
                  >
                    <span>
                      <span className="block font-medium">{s.title}</span>
                      <span className="mt-1 block text-sm text-faint">
                        {s.domain} · {s.ageDays} days ago
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Chip tone={s.kind === "vendor" ? "warn" : "neutral"}>
                        {s.kind === "vendor" ? "Vendor" : "Independent"}
                      </Chip>
                      {stale ? <Chip tone="warn">Stale</Chip> : null}
                    </span>
                  </button>
                  {open ? <p className="border-t border-line px-3 py-3 text-sm">{s.excerpt}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl bg-bad-bg p-4">
          <h2 className="font-display text-2xl text-bad">The case against</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {opp.critique.map((c) => (
              <li key={c.point} className="flex items-start justify-between gap-3 text-sm">
                <span>{c.point}</span>
                <span className="shrink-0 tabular-nums font-medium text-bad">−{c.deduction}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl">This month</h2>
          <p className="mt-2 text-sm text-muted">{opp.falsify}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {opp.tasks.map((task) => (
              <li key={task.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(opp.id, task.id)}
                    className="size-5 accent-accent"
                  />
                  <span className={task.done ? "text-faint line-through" : ""}>{task.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section id="log" className="scroll-mt-20 rounded-xl border border-line bg-card p-4">
          <h2 className="font-display text-2xl">Log a conversation</h2>
          <p className="mt-1 text-sm text-muted">One person. What they actually said. Not a pitch recap.</p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!who.trim() || !note.trim()) return;
              addInterview(opp.id, who, note);
              setWho("");
              setNote("");
            }}
          >
            <input
              className={inputClass}
              placeholder="Who"
              aria-label="Who you spoke with"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            />
            <textarea
              className={`${inputClass} min-h-24 py-3`}
              placeholder="What they said about the pain"
              aria-label="What they said"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" disabled={!who.trim() || !note.trim()} className="w-full sm:w-fit">
              Save note
            </Button>
          </form>
          {opp.interviews.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
              {opp.interviews.map((iv) => (
                <li key={iv.id}>
                  <p className="font-medium">{iv.who}</p>
                  <p className="text-sm text-muted">{iv.note}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => toggleSaved(opp.id)} variant={opp.saved ? "quiet" : "primary"}>
            {opp.saved ? "Remove from shortlist" : "Save to shortlist"}
          </Button>
          {opp.status !== "killed" ? (
            <Button variant="danger" onClick={() => setStatus(opp.id, "killed")}>
              Kill this bet
            </Button>
          ) : (
            <Button variant="quiet" onClick={() => setStatus(opp.id, "testing")}>
              Reopen
            </Button>
          )}
        </div>
      </article>
    </Shell>
  );
}
