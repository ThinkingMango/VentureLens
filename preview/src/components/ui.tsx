import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition-transform duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary: "bg-accent text-accent-fg",
  quiet: "border border-line bg-card text-ink",
  ghost: "text-ink",
  danger: "bg-bad-bg text-bad",
} as const;

export function buttonClass(variant: keyof typeof variants = "primary", className?: string) {
  return cn(buttonBase, variants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function TextLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-md border border-line bg-card px-3 text-base text-ink placeholder:text-faint";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-accent">{children}</p>
  );
}

export function ScoreMark({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "font-display tabular-nums leading-none tracking-tight text-ink",
        size === "lg" ? "text-5xl" : "text-3xl",
      )}
    >
      {score}
    </span>
  );
}

export function Meter({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-sm bg-soft", className)}>
      <span className="block h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </span>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "bad" | "good";
}) {
  const toneClass = {
    neutral: "bg-soft text-muted",
    warn: "bg-warn-bg text-warn",
    bad: "bg-bad-bg text-bad",
    good: "bg-soft text-accent",
  }[tone];
  return (
    <span className={cn("inline-flex min-h-7 items-center rounded-sm px-2 text-sm font-medium", toneClass)}>
      {children}
    </span>
  );
}
