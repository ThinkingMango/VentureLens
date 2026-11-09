import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Button, Eyebrow, Field, inputClass } from "@/components/ui";
import { CAPITALS, GEOS, HOURS } from "@/lib/model";
import { cn } from "@/lib/cn";
import { useDesk } from "@/lib/store";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const profile = useDesk((s) => s.profile);
  const setProfile = useDesk((s) => s.setProfile);
  const reset = useDesk((s) => s.reset);

  return (
    <Shell>
      <div className="rise flex flex-col gap-6">
        <header>
          <Eyebrow>You</Eyebrow>
          <h1 className="mt-2 font-display text-4xl tracking-tight">{profile.name}</h1>
          <p className="mt-2 text-muted">
            Constraints change what is a fit. They never rewrite a score you already researched.
          </p>
        </header>
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
          <Field label="Name">
            <input
              className={inputClass}
              value={profile.name}
              onChange={(e) => setProfile({ name: e.target.value })}
            />
          </Field>
          <Field label="Work you have already been paid for">
            <textarea
              className={`${inputClass} min-h-24 py-3`}
              value={profile.craft}
              onChange={(e) => setProfile({ craft: e.target.value })}
            />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">Hours you can give it</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={profile.hours === h}
                  onClick={() => setProfile({ hours: h })}
                  className={cn(
                    "min-h-11 rounded-md border text-sm font-medium",
                    profile.hours === h
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line bg-card",
                  )}
                >
                  {h}h
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
                  aria-pressed={profile.capital === c.id}
                  onClick={() => setProfile({ capital: c.id })}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-left text-sm",
                    profile.capital === c.id
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line bg-card",
                  )}
                >
                  <span className="font-medium">{c.label}</span>
                  <span className={profile.capital === c.id ? "text-accent-fg/80" : "text-muted"}>
                    {" "}
                    · {c.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Who you can already reach">
            <input
              className={inputClass}
              value={profile.reach}
              onChange={(e) => setProfile({ reach: e.target.value })}
            />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">Market</legend>
            <div className="mt-2 flex flex-col gap-2">
              {GEOS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={profile.geography === g}
                  onClick={() => setProfile({ geography: g })}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-left text-sm font-medium",
                    profile.geography === g
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line bg-card",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="What has to be true" hint="Recurring revenue, a ceiling on hours, a market you will not leave.">
            <textarea
              className={`${inputClass} min-h-24 py-3`}
              value={profile.goal}
              onChange={(e) => setProfile({ goal: e.target.value })}
            />
          </Field>
        </form>
        <p className="text-sm text-faint">
          The live product also runs in 简体中文 and 繁體中文. This preview is English only.
        </p>
        <Button variant="quiet" className="w-fit" onClick={() => reset()}>
          Reset sample workspace
        </Button>
      </div>
    </Shell>
  );
}
