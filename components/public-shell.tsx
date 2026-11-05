"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { useRef, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
const links = [
  { href: "/#whats-inside", label: "What you get" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/demo/dashboard", label: "Live demo" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];
export function PublicShell({ children }: { children: React.ReactNode }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="min-h-screen bg-card text-foreground">
      <header
        className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            menuTrigger.current?.focus();
          }
        }}
      >
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Brand />
          <nav
            className="hidden items-center gap-7 lg:flex"
            aria-label={copy("Main navigation")}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary"
              >
                {copy(link.label)}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <Link href="/login" className="text-sm font-medium">
              {copy("Log in")}
            </Link>
            <Button asChild>
              <Link href="/signup">
                {copy("Get started")}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={open ? copy("Close menu") : copy("Open menu")}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
              ref={menuTrigger}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {open && (
          <nav
            id="public-mobile-menu"
            className="flex flex-col gap-1 border-t bg-card p-5 lg:hidden [&>a]:flex [&>a]:min-h-11 [&>a]:items-center [&>a]:rounded-md [&>a]:px-3 [&>a]:font-medium"
            aria-label={copy("Mobile main navigation")}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {copy(link.label)}
              </Link>
            ))}
            <Link href="/login">{copy("Log in")}</Link>
            <Link href="/signup" className="text-primary">
              {copy("Get started")}
            </Link>
          </nav>
        )}
      </header>
      {children}
      <footer className="border-t bg-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
          <div className="flex flex-col gap-3">
            <Brand />
            <p className="max-w-sm text-sm text-muted-foreground">
              {copy(
                "Evidence-first research for founders exploring GenAI-enabled, recurring-revenue businesses. Private accounts, saved briefs, and a synthetic demo you can explore without signing up.",
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">{copy("Product")}</p>
            <Link href="/#whats-inside" className="text-muted-foreground hover:text-primary">
              {copy("What you get")}
            </Link>
            <Link href="/#how-it-works" className="text-muted-foreground hover:text-primary">
              {copy("How it works")}
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-primary">
              {copy("Pricing")}
            </Link>
            <Link href="/demo/dashboard" className="text-muted-foreground hover:text-primary">
              {copy("Explore demo")}
            </Link>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">{copy("Account")}</p>
            <Link href="/login" className="text-muted-foreground hover:text-primary">
              {copy("Log in")}
            </Link>
            <Link href="/signup" className="text-muted-foreground hover:text-primary">
              {copy("Create a free account")}
            </Link>
            <p className="mt-2 text-muted-foreground">
              {copy("Live research is in private beta. Pricing shown is planned, and no payments are collected yet.")}
            </p>
          </div>
        </div>
        <div className="border-t">
          <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground md:px-8">
            {copy("VentureLens AI · Research output is a starting point for your own validation, not financial or investment advice.")}
          </p>
        </div>
      </footer>
    </div>
  );
}
