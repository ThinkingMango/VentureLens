import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, Target, Telescope, UserRound } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { persistDesk, useDesk } from "@/lib/store";

const tabs = [
  { href: "/desk", label: "Today", icon: Target, match: (p: string) => p === "/desk" },
  {
    href: "/research",
    label: "Research",
    icon: Telescope,
    match: (p: string) =>
      p.startsWith("/research") || p.startsWith("/brief") || p.startsWith("/opportunities"),
  },
  { href: "/shortlist", label: "Shortlist", icon: Bookmark, match: (p: string) => p.startsWith("/shortlist") },
  { href: "/profile", label: "You", icon: UserRound, match: (p: string) => p.startsWith("/profile") },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hydrate = useDesk((s) => s.hydrate);
  const saved = useDesk((s) => s.opportunities.filter((o) => o.saved).length);

  useEffect(() => {
    hydrate();
    return useDesk.subscribe((state) => {
      if (!state.hydrated) return;
      persistDesk();
    });
  }, [hydrate]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-card md:flex">
        <Link to="/" className="px-5 pt-6 font-display text-2xl tracking-tight">
          VentureLens
        </Link>
        <p className="px-5 pt-1 text-sm text-muted">Decision desk</p>
        <nav aria-label="Workspace" className="mt-8 flex flex-col gap-1 px-3">
          {tabs.map((tab) => {
            const active = tab.match(path);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-base",
                  active ? "bg-soft font-medium text-ink" : "text-muted",
                )}
              >
                <tab.icon className="size-5" aria-hidden="true" />
                {tab.label}
                {tab.href === "/shortlist" ? (
                  <span className="ml-auto text-sm tabular-nums text-faint">{saved}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-5 pb-6 text-sm text-faint">
          Scores say worth testing. They are not odds.
        </p>
      </aside>
      <div className="pad-dock">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur md:px-8">
          <Link to="/" className="font-display text-xl tracking-tight md:hidden">
            VentureLens
          </Link>
          <span className="hidden text-sm text-muted md:inline">Private preview on this device</span>
          <Link to="/brief" className="text-sm font-medium text-accent">
            New brief
          </Link>
        </header>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>
      <nav
        aria-label="Workspace"
        className="dock fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card md:hidden"
      >
        <ul className="grid grid-cols-4">
          {tabs.map((tab) => {
            const active = tab.match(path);
            return (
              <li key={tab.href}>
                <Link
                  to={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-ink" : "text-faint",
                  )}
                >
                  <tab.icon className="size-5" aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
