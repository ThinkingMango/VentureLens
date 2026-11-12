"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ProfileChoice({
  id,
  label,
  value,
  options,
  hints,
  maxLength,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  /** Optional explanation per option, shown on hover or keyboard focus of an info icon. */
  hints?: Partial<Record<string, string>>;
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const copy = useCopy();
  const [custom, setCustom] = useState(!options.includes(value));
  const [openHint, setOpenHint] = useState<string | null>(null);
  const isCustom = custom || !options.includes(value);
  const choices = [...options, "__custom__"] as const;

  return (
    <Field>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{copy(label)}</p>
        <div
          role="radiogroup"
          aria-label={copy(label)}
          className="grid gap-3 sm:grid-cols-2"
        >
          {choices.map((option, index) => {
            const selected = option === "__custom__" ? isCustom : !isCustom && value === option;
            const optionId = `${id}-${index}`;
            const hint = option === "__custom__" ? undefined : hints?.[option];
            const hintId = `${optionId}-hint`;
            return (
              <label
                key={option}
                htmlFor={optionId}
                className={cn(
                  "relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/50",
                  selected && "border-primary bg-secondary shadow-[0_0_0_1px_var(--primary)]",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  id={optionId}
                  name={id}
                  type="radio"
                  value={option}
                  checked={selected}
                  disabled={disabled}
                  className="size-4 shrink-0"
                  onChange={() => {
                    const nextCustom = option === "__custom__";
                    setCustom(nextCustom);
                    onChange(nextCustom ? "" : option);
                  }}
                />
                <span>{option === "__custom__" ? copy("Other — describe your own") : copy(option)}</span>
                {hint && (
                  <span className="group/hint relative inline-flex">
                    <button
                      type="button"
                      aria-label={copy("What does this mean?")}
                      aria-describedby={hintId}
                      aria-expanded={openHint === option}
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      // The icon sits inside the option's label: stop a click on it from also selecting the option.
                      onClick={(event) => {
                        event.preventDefault();
                        setOpenHint((current) => (current === option ? null : option));
                      }}
                      onBlur={() => setOpenHint(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setOpenHint(null);
                      }}
                    >
                      <Info className="size-4" aria-hidden="true" />
                    </button>
                    <span
                      id={hintId}
                      role="tooltip"
                      className={cn(
                        "pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs leading-relaxed font-normal text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/hint:visible group-hover/hint:opacity-100 group-has-[:focus-visible]/hint:visible group-has-[:focus-visible]/hint:opacity-100",
                        openHint === option && "visible opacity-100",
                      )}
                    >
                      {copy(hint)}
                    </span>
                  </span>
                )}
                {selected && <Check className="ml-auto size-4 shrink-0 text-primary" aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      </div>
      {isCustom && (
        <>
          <FieldLabel htmlFor={`${id}-custom`}>
            {copy("Your own answer")}
          </FieldLabel>
          <Input
            id={`${id}-custom`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            required
            pattern={".*\\S.*"}
            maxLength={maxLength}
            aria-describedby={`${id}-help`}
          />
          <p id={`${id}-help`} className="text-sm text-muted-foreground">
            {copy("Be specific. Your answer will help tailor your research.")}
          </p>
        </>
      )}
    </Field>
  );
}
