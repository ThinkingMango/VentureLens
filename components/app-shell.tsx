"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Telescope,
  Bookmark,
  UserRound,
  CreditCard,
  CircleHelp,
  ArrowUpRight,
  ChevronDown,
  Plus,
  PanelLeft,
  X,
  ArrowRight,
  Bell,
  FlaskConical,
} from "lucide-react";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDemo } from "@/components/demo-provider";
import { cn } from "@/lib/utils";
const nav = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "My research", href: "/research", icon: Telescope },
  { title: "Saved opportunities", href: "/saved", icon: Bookmark },
  { title: "Founder profile", href: "/profile", icon: UserRound },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const { profile, saved } = useDemo();
  const title = path.startsWith("/opportunities")
    ? "Opportunity detail"
    : path === "/research/new"
      ? "New research"
      : path === "/research/results"
        ? "Research results"
        : path === "/billing"
          ? "Credits & billing"
          : nav.find((n) => n.href === path)?.title || "Workspace";
  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between px-6">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-1 flex-col px-4 py-5">
        <div className="mb-7 flex items-center gap-3 rounded-lg border p-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-secondary font-semibold text-primary">
            A
          </span>
          <div className="flex-1">
            <p className="font-medium">Personal workspace</p>
            <p className="text-sm text-muted-foreground">Demo account</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
        <p className="mb-3 px-3 text-sm font-medium text-muted-foreground">
          WORKSPACE
        </p>
        <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={path === n.href ? "page" : undefined}
              className={cn(
                "nav-link",
                (path === n.href ||
                  (n.href === "/research" &&
                    (path.startsWith("/research/") ||
                      path.startsWith("/opportunities/")))) &&
                  "active",
              )}
            >
              <n.icon className="size-[18px]" />
              {n.title}
              {n.href === "/saved" && (
                <span className="ml-auto text-sm">{saved.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <Button asChild className="mt-6">
          <Link href="/research/new" onClick={() => setOpen(false)}>
            <Plus />
            New research
          </Link>
        </Button>
        <div className="mt-auto flex flex-col gap-5 pt-12">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Your research credits</span>
              <span className="text-primary">
                <Telescope className="size-4" />
              </span>
            </div>
            <p className="mt-3">
              <strong className="text-xl font-semibold">8</strong>
              <span className="text-muted-foreground"> / 10 available</span>
            </p>
            <div className="progress-track mt-3">
              <div className="progress-fill w-4/5" />
            </div>
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-between font-medium text-primary"
            >
              Manage credits
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className={cn("nav-link", path === "/billing" && "active")}
            >
              <CreditCard className="size-[18px]" />
              Credits & billing
            </Link>
            <button
              className="nav-link text-left"
              onClick={() => setHelp(true)}
            >
              <CircleHelp className="size-[18px]" />
              Help & resources
              <ArrowUpRight className="ml-auto size-4" />
            </button>
          </div>
        </div>
      </div>
      <Link
        href="/profile"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 border-t px-6 py-5"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-semibold text-primary">
          {profile.name.slice(0, 1)}
        </span>
        <div className="flex-1">
          <p className="font-medium">{profile.name} Morgan</p>
          <p className="text-sm text-muted-foreground">Demo founder</p>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" />
      </Link>
    </>
  );
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
        {sidebar}
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 flex h-dvh w-72 max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-card p-0 text-foreground sm:rounded-none [&>button]:hidden">
          <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate your demo workspace.
          </DialogDescription>
          {sidebar}
        </DialogContent>
      </Dialog>
      <div className="lg:pl-64">
        <header className="flex h-[72px] items-center justify-between gap-3 border-b bg-card px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <PanelLeft />
            </Button>
            <span className="hidden text-muted-foreground sm:inline">
              Workspace
            </span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="truncate font-medium">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Badge
              variant="secondary"
              className="gap-1.5 rounded-md font-normal"
            >
              <FlaskConical className="size-3.5" />
              <span>
                Demo<span className="hidden sm:inline"> mode</span>
              </span>
            </Badge>
            <button
              aria-label="Notifications"
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
              onClick={() => setHelp(true)}
            >
              <Bell className="size-[18px]" />
            </button>
            <span className="hidden size-8 items-center justify-center rounded-full bg-secondary font-medium text-primary sm:flex">
              {profile.name.slice(0, 1)}M
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6 p-5 md:gap-8 md:p-8 xl:p-10"
        >
          {children}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-sm text-muted-foreground">
            <p>Thoughtful research. Better decisions.</p>
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-primary"
            >
              VentureLens AI
              <ArrowUpRight className="size-3.5" />
            </Link>
          </footer>
        </main>
      </div>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your demo workspace</DialogTitle>
            <DialogDescription>
              Explore the complete research journey without connecting any
              services.
            </DialogDescription>
          </DialogHeader>
          <p>
            Research, opportunity scores, credits, and sources are synthetic.
            Saved ideas and profile changes stay in memory until you refresh. No
            real account, payment, or AI request is created.
          </p>
          <Button asChild onClick={() => setHelp(false)}>
            <Link href="/research/new">
              Start a demo research run
              <ArrowRight />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
