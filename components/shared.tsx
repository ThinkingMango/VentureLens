"use client";
import Link from "@/components/workspace-link";
import {
  Aperture,
  ArrowUpRight,
  Info,
  FileText,
  Headphones,
  ChartNoAxesCombined,
  Workflow,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { demoNotice } from "@/lib/demo-data";
import { useOptionalWorkspace } from "@/components/demo-provider";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="VentureLens AI home"
      className="inline-flex shrink-0 items-center gap-2.5"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Aperture className="size-6" strokeWidth={1.7} />
      </span>
      {!compact && (
        <span className="text-xl font-semibold tracking-tight">
          VentureLens<span className="ml-1 text-primary">AI</span>
        </span>
      )}
    </Link>
  );
}
export function DemoNote({
  className,
  short = false,
}: {
  className?: string;
  short?: boolean;
}) {
  const workspace = useOptionalWorkspace();
  if (workspace && !workspace.isDemo) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        {short
          ? "Demo workspace · All research and financial data is synthetic."
          : demoNotice}
      </p>
    </div>
  );
}
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading text-balance">{title}</h1>
        <p className="text-muted-foreground text-pretty">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function SectionTitle({
  title,
  description,
  href,
  label = "View all",
}: {
  title: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {label}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
export const opportunityIcons = {
  file: FileText,
  headset: Headphones,
  chart: ChartNoAxesCombined,
  workflow: Workflow,
};
export function Confidence({ level }: { level: string }) {
  return (
    <Badge variant="secondary" className="gap-1.5 rounded-md font-medium">
      <span className="demo-dot" />
      {level} confidence
    </Badge>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="link" className="h-auto p-0">
      <Link href={href}>
        {children}
        <ArrowUpRight data-icon="inline-end" />
      </Link>
    </Button>
  );
}
