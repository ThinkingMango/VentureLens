"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ProfileChoice({
  id,
  label,
  value,
  options,
  maxLength,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const copy = useCopy();
  const [custom, setCustom] = useState(!options.includes(value));
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
