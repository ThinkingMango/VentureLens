"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCopy } from "@/i18n/use-copy";
import { cn } from "@/lib/utils";

/** Tabs between the operator pages. Every page behind them checks the administrator claim on the server. */
export function AdminNav() {
  const copy = useCopy();
  const path = usePathname();
  const tabs = [
    { href: "/admin", label: copy("AI providers"), active: path === "/admin" },
    { href: "/admin/runs", label: copy("Research runs"), active: path.startsWith("/admin/runs") },
    { href: "/admin/quality", label: copy("Research quality"), active: path.startsWith("/admin/quality") },
  ];
  return (
    <nav aria-label={copy("Administration")} className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn("inline-flex min-h-11 shrink-0 items-center rounded-md px-4 text-sm font-medium hover:bg-secondary", tab.active ? "bg-secondary text-foreground" : "text-muted-foreground")}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
