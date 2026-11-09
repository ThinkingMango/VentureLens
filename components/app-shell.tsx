"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "@/components/workspace-link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Telescope,
  Bookmark,
  UserRound,
  CreditCard,
  CircleHelp,
  ArrowUpRight,
  Plus,
  PanelLeft,
  X,
  ArrowRight,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
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
import { ResearchAccessCard } from "@/components/live-workspace";
import { cn } from "@/lib/utils";
const nav = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "My research", href: "/research", icon: Telescope },
  { title: "Saved opportunities", href: "/saved", icon: Bookmark },
  { title: "Founder profile", href: "/profile", icon: UserRound },
];
export function AppShell({ children, isAdmin = false }: { children: React.ReactNode; isAdmin?: boolean }) {
  const copy = useCopy();
  const pathname = usePathname();
  const path = pathname.startsWith("/demo/") ? pathname.slice(5) : pathname;
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const helpTrigger = useRef<HTMLButtonElement | null>(null);
  const navTrigger = useRef<HTMLButtonElement | null>(null);
  const { profile, saved, data, isDemo } = useDemo();
  const [signingOut, setSigningOut] = useState(false);
  async function logout() {
    setSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace("/login");
    } catch {
      toast.error(copy("You could not be logged out. Please try again."));
      setSigningOut(false);
    }
  }
  const title = path === "/admin" ? "AI providers" : path.startsWith("/opportunities")
    ? "Opportunity detail"
    : path === "/research/new"
      ? "New research"
      : path === "/research/results"
        ? "Research results"
        : path === "/billing"
          ? "Credits & billing"
          : /^\/research\/[^/]+$/.test(path)
            ? "Research run & report"
            : nav.find((n) => n.href === path)?.title || "Workspace";
  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between px-6">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={copy("Close navigation")}
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-1 flex-col px-4 py-5">
        <div className="mb-7 flex items-center gap-3 rounded-lg border p-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-secondary font-semibold text-primary">
            {profile.name.slice(0, 1) || copy("F")}
          </span>
          <div className="flex-1">
            <p className="font-medium">{copy("Personal workspace")}</p>
            <p className="text-sm text-muted-foreground">
              {isDemo ? copy("Demo account") : copy("Private account")}
            </p>
          </div>
        </div>
        <p className="mb-3 px-3 text-sm font-medium text-muted-foreground">
          {copy("WORKSPACE")}
        </p>
        <nav
          aria-label={copy("Workspace navigation")}
          className="flex flex-col gap-1"
        >
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
              {copy(n.title)}
              {n.href === "/saved" && (
                <span className="ml-auto text-sm">{saved.length}</span>
              )}
            </Link>
          ))}
          {isAdmin && !isDemo && (
            <Link href="/admin" onClick={() => setOpen(false)} aria-current={path === "/admin" ? "page" : undefined} className={cn("nav-link", path === "/admin" && "active")}>
              <ShieldCheck className="size-[18px]" aria-hidden="true" />
              {copy("Admin")}
            </Link>
          )}
        </nav>
        <Button asChild className="mt-6">
          <Link href="/research/new" onClick={() => setOpen(false)}>
            <Plus />
            {copy("New research")}
          </Link>
        </Button>
        <div className="mt-auto flex flex-col gap-5 pt-12">
          {!isDemo && <ResearchAccessCard compact />}
          {isDemo && (
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {copy("Your research credits")}
                </span>
                <span className="text-primary">
                  <Telescope className="size-4" />
                </span>
              </div>
              <p className="mt-3">
                <strong className="text-xl font-semibold">8</strong>
                <span className="text-muted-foreground">
                  {" "}
                  {copy("/ 10 available")}
                </span>
              </p>
              <div className="progress-track mt-3">
                <div className="progress-fill w-4/5" />
              </div>
              <Link
                href="/billing"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center justify-between font-medium text-primary"
              >
                {copy("Manage credits")}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className={cn("nav-link", path === "/billing" && "active")}
            >
              <CreditCard className="size-[18px]" />
              {copy("Credits & billing")}
            </Link>
            <button
              className="nav-link text-left"
              onClick={(event) => {
                helpTrigger.current = event.currentTarget;
                setHelp(true);
              }}
            >
              <CircleHelp className="size-[18px]" />
              {copy("Help & resources")}
              <ArrowUpRight className="ml-auto size-4" />
            </button>
            {!isDemo && (
              <button
                className="nav-link text-left"
                onClick={logout}
                disabled={signingOut}
              >
                {signingOut ? copy("Logging out…") : copy("Log out")}
              </button>
            )}
            {isDemo && (
              <Link className="nav-link" href="/signup">
                {copy("Create a real account")}
                <ArrowRight className="ml-auto size-4" />
              </Link>
            )}
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
          <p className="font-medium">
            {profile.name}
          </p>
          <p className="max-w-40 truncate text-sm text-muted-foreground">
            {isDemo ? copy("Demo founder") : data?.email}
          </p>
        </div>
        <UserRound className="size-4 text-muted-foreground" />
      </Link>
    </>
  );
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:p-3"
      >
        {copy("Skip to content")}
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r bg-card lg:flex">
        {sidebar}
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            navTrigger.current?.focus();
          }}
          className="left-0 top-0 flex h-dvh w-72 max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-card p-0 text-foreground sm:rounded-none [&>button]:hidden"
        >
          <DialogTitle className="sr-only">
            {copy("Workspace navigation")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isDemo
              ? copy("Navigate your demo workspace.")
              : copy("Navigate your private workspace.")}
          </DialogDescription>
          {sidebar}
        </DialogContent>
      </Dialog>
      <div className="lg:pl-64">
        <header className="flex min-h-16 items-center justify-between gap-2 border-b bg-card px-3 py-2 sm:min-h-20 sm:gap-3 sm:px-4 sm:py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              ref={navTrigger}
              onClick={() => setOpen(true)}
              aria-label={copy("Open navigation")}
            >
              <PanelLeft />
            </Button>
            <span className="hidden text-muted-foreground sm:inline">
              {copy("Workspace")}
            </span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="truncate font-medium">{copy(title)}</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <LanguageSwitcher />
            {/* On phones the sidebar and page notices already say which
                workspace this is; the badge would push the header to two rows. */}
            <Badge
              variant="secondary"
              className="hidden gap-1.5 rounded-md font-normal sm:inline-flex"
            >
              <FlaskConical className="size-3.5" />
              <span>
                {isDemo ? <>{copy("Demo mode")}</> : copy("Private workspace")}
              </span>
            </Badge>
            <button
              aria-label={copy("Help & resources")}
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
              onClick={(event) => {
                helpTrigger.current = event.currentTarget;
                setHelp(true);
              }}
            >
              <CircleHelp className="size-[18px]" />
            </button>
            <span className="hidden size-8 items-center justify-center rounded-full bg-secondary font-medium text-primary sm:flex">
              {profile.name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6 p-5 md:gap-8 md:p-8 xl:p-10"
        >
          {children}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-sm text-muted-foreground">
            <p>{copy("Thoughtful research. Better decisions.")}</p>
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
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            helpTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isDemo
                ? copy("Your demo workspace")
                : copy("Your private workspace")}
            </DialogTitle>
            <DialogDescription>
              {isDemo
                ? copy(
                    "Explore the complete research journey without connecting any services.",
                  )
                : copy(
                    "Your founder profile and research briefs are securely saved to your account.",
                  )}
            </DialogDescription>
          </DialogHeader>
          <p>
            {isDemo
              ? copy(
                  "Research, opportunity scores, credits, and sources are synthetic. Saved ideas and profile changes stay in memory until you refresh. No real account, payment, or AI request is created.",
                )
              : copy(
                  "Your records are private to your verified session. Authorized development accounts can run Qwen research with external retrieval. Payments are not connected. Demo opportunities and balances never enter your account.",
                )}
          </p>
          <Button asChild onClick={() => setHelp(false)}>
            <Link href="/research/new">
              {isDemo
                ? copy("Start a demo research run")
                : copy("Create a research brief")}
              <ArrowRight />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
