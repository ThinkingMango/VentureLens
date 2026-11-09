import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Eyebrow, Field, inputClass } from "@/components/ui";
import { CAPITALS, GEOS, HOURS, type Brief } from "@/lib/model";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/brief")({ component: BriefPage });

const steps = ["Craft", "Limits", "Reach", "Aim"];

function BriefPage() {
  const profile = useDesk((s) => s.profile);
  const addRun = useDesk((s) => s.addRun);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief>({
    craft: profile.craft,
    hours: profile.hours,
    capital: profile.capital,
    reach: profile.reach,
    geography: profile.geography,
    goal: profile.goal,
  });

  function patch(p: Partial<Brief>) {
    setBrief((b) => ({ ...b, ...p }));
  }

  function finish() {
    const id = addRun(brief);
    sessionStorage.setItem("vl-fresh", id);
    void navigate({ to: "/research/$runId", params: { runId: id } });
  }

  return (
    <Shell>
      <div className="rise flex flex-col gap-6 pb-24">
        <header>
          <Eyebrow>
            Brief {step + 1} of {steps.length}
          </Eyebrow>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden="true">
            {steps.map((label, i) => (
              <span
                key={label}
                className={cn("h-1 rounded-sm", i <= step ? "bg-accent" : "bg-soft")}
              />
            ))}
          </div>
        </header>
        {step === 0 ? (
          <section className="flex flex-col gap-4">
            <h1 className="font-display text-4xl leading-tight tracking-tight">
              What have you already been paid to do?
            </h1>
            <Field label="The craft" hint="A job, a client type, a motion you can repeat.">
              <textarea
                className={`${inputClass} min-h-32 py-3`}
                value={brief.craft}
                onChange={(e) => patch({ craft: e.target.value })}
              />
            </Field>
          </section>
        ) : null}
        {step === 1 ? (
          <section className="flex flex-col gap-5">
            <h1 className="font-display text-4xl leading-tight tracking-tight">
              What can this week actually hold?
            </h1>
            <fieldset>
              <legend className="text-sm font-medium">Hours</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={brief.hours === h}
                    onClick={() => patch({ hours: h })}
                    className={cn(
                      "min-h-11 rounded-md border text-sm font-medium",
                      brief.hours === h ? "border-accent bg-accent text-accent-fg" : "border-line bg-card",
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">Capital for a first test</legend>
              <div className="mt-2 flex flex-col gap-2">
                {CAPITALS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={brief.capital === c.id}
                    onClick={() => patch({ capital: c.id })}
                    className={cn(
                      "min-h-11 rounded-md border px-3 text-left text-sm font-medium",
                      brief.capital === c.id
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-line bg-card",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        ) : null}
        {step === 2 ? (
          <section className="flex flex-col gap-5">
            <h1 className="font-display text-4xl leading-tight tracking-tight">
              Who can you already talk to?
            </h1>
            <Field label="Reach" hint="Not a bought list. People who would reply.">
              <textarea
                className={`${inputClass} min-h-28 py-3`}
                value={brief.reach}
                onChange={(e) => patch({ reach: e.target.value })}
              />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium">Market</legend>
              <div className="mt-2 flex flex-col gap-2">
                {GEOS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={brief.geography === g}
                    onClick={() => patch({ geography: g })}
                    className={cn(
                      "min-h-11 rounded-md border px-3 text-left text-sm font-medium",
                      brief.geography === g
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-line bg-card",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        ) : null}
        {step === 3 ? (
          <section className="flex flex-col gap-4">
            <h1 className="font-display text-4xl leading-tight tracking-tight">
              What has to stay true?
            </h1>
            <Field label="The constraint that is not negotiable">
              <textarea
                className={`${inputClass} min-h-32 py-3`}
                value={brief.goal}
                onChange={(e) => patch({ goal: e.target.value })}
              />
            </Field>
            <p className="text-sm text-muted">
              This preview will not call a model. You will see the same evidence gate, labeled as a fixture, so the shape of a run is clear.
            </p>
          </section>
        ) : null}
      </div>
      <div className="above-dock flex gap-2 border-t border-line bg-paper px-4 py-3">
        <Button variant="quiet" className="flex-1" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < 3 ? (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button className="flex-1" onClick={finish}>
            Run the gate
          </Button>
        )}
      </div>
    </Shell>
  );
}
