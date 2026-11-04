"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/shared";
import { Button } from "@/components/ui/button";
export function PublicShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-card text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Brand />
          <nav
            className="hidden items-center gap-8 lg:flex"
            aria-label="Main navigation"
          >
            <Link
              href="/#how-it-works"
              className="text-muted-foreground hover:text-primary"
            >
              How it works
            </Link>
            <Link
              href="/demo/dashboard"
              className="text-muted-foreground hover:text-primary"
            >
              Explore the platform
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-primary"
            >
              Pricing
            </Link>
          </nav>
          <div className="hidden items-center gap-5 lg:flex">
            <Link href="/login" className="font-medium">
              Log in
            </Link>
            <Button asChild>
              <Link href="/signup">
                Get started
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <nav
            className="flex flex-col gap-4 border-t p-5 lg:hidden"
            aria-label="Mobile main navigation"
          >
            <Link href="/demo/dashboard">Explore the platform</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Log in</Link>
            <Link href="/signup">Get started</Link>
          </nav>
        )}
      </header>
      {children}
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-8 md:flex-row md:items-center md:px-8">
          <div className="flex flex-col gap-2">
            <Brand />
            <p className="text-sm text-muted-foreground">
              A clearer lens on your next business.
            </p>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Private accounts and saved research briefs. Sample reports and
            illustrative prices are available in the separate demo.
          </p>
          <div className="flex gap-6">
            <Link href="/pricing">Pricing</Link>
            <Link href="/demo/dashboard">Explore demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
