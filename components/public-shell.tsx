"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { mailto, supportEmail } from "@/lib/contact";
// In the order the sections appear on the landing page.
const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#whats-inside", label: "What you get" },
  { href: "/demo/dashboard", label: "Demo" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];
export function PublicShell({ children }: { children: React.ReactNode }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:p-3"
      >
        {copy("Skip to content")}
      </a>
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
            <LanguageSwitcher />
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
            <div className="hidden sm:block lg:hidden"><LanguageSwitcher /></div>
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
            className="flex flex-col gap-2 border-t bg-card p-5 lg:hidden [&>a]:flex [&>a]:min-h-11 [&>a]:items-center [&>a]:rounded-lg [&>a]:px-3 [&>a]:font-medium"
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
            <Button asChild className="mt-2 justify-center">
              <Link href="/signup">{copy("Get started")}</Link>
            </Button>
            <div className="pt-2 sm:hidden"><LanguageSwitcher /></div>
          </nav>
        )}
      </header>
      {children}
      <MobileCtaBar />
      <footer className="border-t bg-background">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-10 md:px-8 md:py-12">
          <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
            <Brand />
            <p className="max-w-sm text-sm text-muted-foreground">
              {copy(
                "Evidence-first research for founders exploring GenAI-enabled, recurring-revenue businesses. Private accounts, saved briefs, and a synthetic demo you can explore without signing up.",
              )}
            </p>
          </div>
          <div className="flex flex-col gap-0.5 text-sm md:gap-2">
            <p className="pb-1 font-semibold md:pb-0">{copy("Product")}</p>
            <Link
              href="/#whats-inside"
              className="py-1.5 text-muted-foreground hover:text-primary md:py-0"
            >
              {copy("What you get")}
            </Link>
            <Link
              href="/#how-it-works"
              className="py-1.5 text-muted-foreground hover:text-primary md:py-0"
            >
              {copy("How it works")}
            </Link>
            <Link
              href="/pricing"
              className="py-1.5 text-muted-foreground hover:text-primary md:py-0"
            >
              {copy("Pricing")}
            </Link>
            <Link
              href="/demo/dashboard"
              className="py-1.5 text-muted-foreground hover:text-primary md:py-0"
            >
              {copy("Explore demo")}
            </Link>
          </div>
          <div className="flex flex-col gap-0.5 text-sm md:gap-2">
            <p className="pb-1 font-semibold md:pb-0">{copy("Account")}</p>
            <Link
              href="/login"
              className="py-1.5 text-muted-foreground hover:text-primary md:py-0"
            >
              {copy("Log in")}
            </Link>
            <Link
              href="/signup"
              className="py-1.5 text-muted-foreground hover:text-primary md:py-0"
            >
              {copy("Create a free account")}
            </Link>
            <p className="mt-2 text-muted-foreground">
              {copy(
                "Every confirmed account includes 10 free research runs. Pricing shown is planned, and no payments are collected yet.",
              )}
            </p>
          </div>
          <div className="flex flex-col gap-0.5 text-sm md:gap-2">
            <p className="pb-1 font-semibold md:pb-0">{copy("Help")}</p>
            <Link href="/support" className="py-1.5 text-muted-foreground hover:text-primary md:py-0">
              {copy("Support")}
            </Link>
            <Link href="/privacy" className="py-1.5 text-muted-foreground hover:text-primary md:py-0">
              {copy("Privacy Policy")}
            </Link>
            <a href={mailto(supportEmail)} className="mt-2 break-all text-muted-foreground hover:text-primary">
              {supportEmail}
            </a>
          </div>
        </div>
        <div className="border-t">
          <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground md:px-8">
            {copy(
              "VentureLens AI · Research output is a starting point for your own validation, not financial or investment advice.",
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Phones only: once the page's own call to action ([data-cta-start]) has scrolled away, keep "Get started" and the
 * demo one tap away, until the closing call to action ([data-cta-end]) comes into view. Pages without the markers
 * never show it. Display comes from Tailwind ("flex lg:hidden"); globals.css only slides it in and out.
 */
function MobileCtaBar() {
  const copy = useCopy();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const start = document.querySelector("[data-cta-start]");
    const end = document.querySelector("[data-cta-end]");
    if (!start) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const passedStart = start.getBoundingClientRect().bottom < 0;
      const beforeEnd = !end || end.getBoundingClientRect().top > window.innerHeight;
      setVisible(passedStart && beforeEnd);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="mobile-cta flex gap-3 lg:hidden" data-visible={visible} inert={!visible}>
      <Button asChild className="flex-1">
        <Link href="/signup">{copy("Get started")}</Link>
      </Button>
      <Button asChild variant="outline" className="flex-1">
        <Link href="/demo/dashboard">{copy("Try the demo")}</Link>
      </Button>
    </div>
  );
}
