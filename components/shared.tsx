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
import { demoNotice } from "@/lib/demo-data";
import { useOptionalWorkspace } from "@/components/demo-provider";
export function Brand({ compact = false }: { compact?: boolean }) {
  const copy = useCopy();
  return (
    <Link
      href="/"
      aria-label={copy("VentureLens AI home")}
      className="inline-flex shrink-0 items-center gap-2.5"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Aperture className="size-6" strokeWidth={1.7} />
      </span>
      {!compact && (
        <span className="text-xl font-semibold tracking-tight">
          {copy("VentureLens")}
          <span className="ml-1 text-primary">AI</span>
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
    <div className="flex items-center justify-between gap-4">
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
// How many of the three signal bars a confidence level fills.
const confidenceStrength: Record<string, number> = {
  Higher: 3,
  Medium: 2,
  moderate: 2,
  Lower: 1,
  limited: 1,
};
export function Confidence({ level }: { level: string }) {
  const copy = useCopy();
  const strength = confidenceStrength[level] ?? 2;
  return (
    <Badge variant="secondary" className="gap-2 rounded-md font-medium">
      {/* Signal bars encode the level visually; the text carries it for assistive tech. */}
      <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-[3px] rounded-[1px]",
              bar <= strength ? "bg-current" : "bg-current opacity-25",
            )}
            style={{ height: `${bar * 4}px` }}
          />
        ))}
      </span>
      {["Higher", "Medium", "Lower"].includes(level)
        ? copy("{level} confidence", { level: copy(level) })
        : copy(confidenceLabels[level] ?? level)}
    </Badge>
  );
}
/**
 * A score out of 100 drawn as a ring, so the number people compare first
 * is also the first thing the eye lands on. The ring is a gauge, not
 * decoration: its fill is the score.
 */
export function ScoreRing({
  score,
  label,
  size = "md",
}: {
  score: number;
  /** Accessible name, e.g. "Demo score: 87 out of 100". */
  label: string;
  size?: "md" | "lg";
}) {
  const px = size === "lg" ? 96 : 60;
  const stroke = size === "lg" ? 8 : 5;
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, score));
  return (
    <div
      role="img"
      aria-label={label}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: px, height: px }}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="var(--score-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          "absolute font-semibold tabular-nums tracking-tight",
          size === "lg" ? "text-3xl" : "text-lg",
        )}
      >
        {score}
      </span>
    </div>
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
