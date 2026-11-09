"use client";
import { useCopy } from "@/i18n/use-copy";

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
import { demoNotice } from "@/lib/demo-notice";
import { useOptionalWorkspace } from "@/components/demo-provider";
export function Brand({ compact = false }: { compact?: boolean }) {
  const copy = useCopy();
  return (
    <Link
      href="/"
      aria-label={copy("VentureLens AI home")}
      className="inline-flex shrink-0 items-center gap-2.5 rounded-lg"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-primary/20 bg-secondary text-primary">
        <Aperture className="size-5" strokeWidth={1.6} />
      </span>
      {!compact && (
        <span className="font-display text-[1.65rem] leading-none tracking-[-0.035em]">
          {copy("VentureLens")}
          <span className="ml-1.5 font-sans text-xs font-semibold tracking-normal text-primary">AI</span>
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
  const copy = useCopy();
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
          ? copy(
              "Demo workspace · All research and financial data is synthetic.",
            )
          : copy(demoNotice)}
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
      <div className="flex min-w-0 flex-col gap-2">
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
  const copy = useCopy();
  return (
    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div>
        <h2 className="text-lg font-semibold">{copy(title)}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {copy(description)}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {copy(label)}
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
const confidenceLabels: Record<string, string> = {
  moderate: "Moderate: primary validation still needed",
  limited: "Limited: few independent sources",
};
export function Confidence({ level }: { level: string }) {
  const copy = useCopy();
  return (
    <Badge variant="secondary" className="gap-1.5 rounded-md font-medium">
      <span className="demo-dot" />
      {["Higher", "Medium", "Lower"].includes(level)
        ? copy("{level} confidence", { level: copy(level) })
        : copy(confidenceLabels[level] ?? level)}
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
  const copy = useCopy();
  return (
    <Button asChild variant="link" className="h-auto p-0">
      <Link href={href}>
        {children}
        <ArrowUpRight data-icon="inline-end" />
      </Link>
    </Button>
  );
}
