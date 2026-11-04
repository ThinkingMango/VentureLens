"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
export function PublicShell({ children }: { children: React.ReactNode }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-card text-foreground">
      <header className="border-b">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Brand />
          <nav
            className="hidden items-center gap-8 lg:flex"
            aria-label={copy("Main navigation")}
          >
            <Link
              href="/#how-it-works"
              className="text-muted-foreground hover:text-primary"
            >
              {copy("How it works")}
            </Link>
            <Link
              href="/demo/dashboard"
              className="text-muted-foreground hover:text-primary"
            >
              {copy("Explore the platform")}
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-primary"
            >
              {copy("Pricing")}
            </Link>
          </nav>
          <div className="hidden items-center gap-5 lg:flex">
            <Link href="/login" className="font-medium">
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
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {open && (
          <nav
            className="flex flex-col gap-4 border-t p-5 lg:hidden"
            aria-label={copy("Mobile main navigation")}
          >
            <Link href="/demo/dashboard">{copy("Explore the platform")}</Link>
            <Link href="/pricing">{copy("Pricing")}</Link>
            <Link href="/login">{copy("Log in")}</Link>
            <Link href="/signup">{copy("Get started")}</Link>
          </nav>
        )}
      </header>
      {children}
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-8 md:flex-row md:items-center md:px-8">
          <div className="flex flex-col gap-2">
            <Brand />
            <p className="text-sm text-muted-foreground">
              {copy("A clearer lens on your next business.")}
            </p>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {copy(
              "Private accounts and saved research briefs. Sample reports and illustrative prices are available in the separate demo.",
            )}
          </p>
          <div className="flex gap-6">
            <Link href="/pricing">{copy("Pricing")}</Link>
            <Link href="/demo/dashboard">{copy("Explore demo")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
