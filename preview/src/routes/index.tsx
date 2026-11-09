import { createFileRoute } from "@tanstack/react-router";
import { Ban, Link2, Scale } from "lucide-react";
import { TextLink } from "@/components/ui";

export const Route = createFileRoute("/")({ component: Home });

const rules = [
  {
    icon: Link2,
    title: "Two domains, or it is out",
    text: "A hypothesis stays only when two unrelated sites support it, and one of them is not selling the fix.",
  },
  {
    icon: Scale,
    title: "The score has a ceiling",
    text: "Thin evidence cannot pass 70. Strong evidence stops at 85. The number means worth a test.",
  },
  {
    icon: Ban,
    title: "Review can only subtract",
    text: "A second pass argues against the idea. It may deduct points. It cannot put enthusiasm back.",
  },
];

function Home() {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-5 py-5 md:px-10">
        <span className="font-display text-2xl tracking-tight">VentureLens</span>
        <TextLink to="/desk" variant="ghost" className="px-2">
          Open the desk
        </TextLink>
      </header>
      <main id="main" className="mx-auto grid max-w-6xl items-start gap-12 px-5 pt-4 pb-32 md:grid-cols-[1.15fr_0.85fr] md:px-10 md:pt-16">
        <div className="rise">
          <p className="text-sm font-medium text-accent">Evidence before enthusiasm</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Find a business worth testing.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Describe the work you already know. VentureLens keeps a short list of recurring offers, each with sources, a capped score, a critique, and the one question to ask this week.
          </p>
          <div className="mt-8 hidden flex-wrap gap-3 md:flex">
            <TextLink to="/desk">Open the decision desk</TextLink>
            <TextLink to="/opportunities/proposal-studio" variant="quiet">
              Read a sample bet
            </TextLink>
          </div>
          <p className="mt-6 max-w-xl text-sm text-faint">
            Redesigned preview of VentureLens. The evidence here is a fixture, saved only on this device. Live research still drops ideas that cannot be sourced.
          </p>
        </div>
        <aside className="rise rounded-xl border border-line bg-card p-5">
          <p className="text-sm text-faint">Sample bet · not a probability</p>
          <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight">
            Proposal studio for boutique agencies
          </h2>
          <div className="mt-5 flex items-end justify-between gap-4 border-y border-line py-4">
            <div>
              <p className="font-display text-5xl tabular-nums leading-none">78</p>
              <p className="mt-2 text-sm text-muted">Moderate evidence · cap 85</p>
            </div>
            <p className="max-w-44 text-right text-sm text-muted">
              Worth a conversation. Not a forecast.
            </p>
          </div>
          <p className="mt-4 text-base">
            “How many hours did the last proposal take, and who owned it?”
          </p>
          <p className="mt-3 text-sm text-muted">
            Ask five studio owners. If they cannot answer, kill the idea.
          </p>
          <TextLink to="/opportunities/proposal-studio" variant="quiet" className="mt-5 hidden w-full md:inline-flex">
            Open this bet
          </TextLink>
        </aside>
      </main>
      <section className="mx-auto max-w-6xl px-5 pb-28 md:px-10">
        <h2 className="font-display text-3xl tracking-tight">Rules the report cannot break</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {rules.map((rule) => (
            <li key={rule.title} className="rounded-xl border border-line bg-card p-4">
              <rule.icon className="size-5 text-accent" aria-hidden="true" />
              <h3 className="mt-3 font-display text-xl">{rule.title}</h3>
              <p className="mt-2 text-sm text-muted">{rule.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="above-dock border-t border-line bg-paper px-4 py-3 md:hidden">
        <TextLink to="/desk" className="w-full">
          Open the decision desk
        </TextLink>
      </div>
    </div>
  );
}
