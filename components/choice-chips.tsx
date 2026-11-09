"use client";
import { Check } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { cn } from "@/lib/utils";
import { toggleChoice } from "@/lib/research-options";

type Group<T extends string> = { label: string; options: readonly T[] };

/**
 * A multi-select of canonical option values, shown as toggle chips. Each chip is a native checkbox inside a label,
 * so it works with the keyboard and screen readers like any checkbox group. The "open" choice is shown first and
 * replaces every other choice; at the limit, the remaining choices are disabled until one is removed.
 */
export function ChoiceChips<T extends string>({
  id,
  legend,
  open,
  groups,
  selected,
  max,
  onChange,
}: {
  id: string;
  legend: string;
  open: T;
  groups: readonly Group<T>[];
  selected: readonly T[];
  max: number;
  onChange: (next: T[]) => void;
}) {
  const copy = useCopy();
  const full = selected.filter((value) => value !== open).length >= max;
  const chip = (value: T) => {
    const checked = selected.includes(value);
    const disabled = !checked && full && value !== open;
    return (
      <label
        key={value}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
          checked ? "border-primary bg-secondary font-medium text-primary" : "hover:border-primary/60",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          name={id}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(toggleChoice(selected, value, open, max))}
        />
        {checked && <Check aria-hidden className="size-3.5" />}
        {copy(value)}
      </label>
    );
  };
  return (
    <fieldset id={id} aria-describedby={`${id}-help`} className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-sm font-medium leading-snug">{legend}</legend>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {copy("Choose up to {max}. “{open}” clears the other choices.", { max, open: copy(open) })}{" "}
        <span aria-live="polite">{copy("{count} of {max} selected", { count: selected.length, max })}</span>
      </p>
      <div className="flex flex-wrap gap-2">{chip(open)}</div>
      {groups.map((group) => (
        <div key={group.label || "options"} className="flex flex-col gap-2">
          {group.label && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy(group.label)}</p>}
          <div className="flex flex-wrap gap-2">{group.options.filter((value) => value !== open).map(chip)}</div>
        </div>
      ))}
    </fieldset>
  );
}
