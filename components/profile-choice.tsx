"use client";

import { useState } from "react";
import { useCopy } from "@/i18n/use-copy";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
  return (
    <Field>
      <FieldLabel htmlFor={id}>{copy(label)}</FieldLabel>
      <select
        id={id}
        className="field-select"
        value={isCustom ? "__custom__" : value}
        disabled={disabled}
        onChange={(event) => {
          const nextCustom = event.target.value === "__custom__";
          setCustom(nextCustom);
          onChange(nextCustom ? "" : event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {copy(option)}
          </option>
        ))}
        <option value="__custom__">{copy("Other — describe your own")}</option>
      </select>
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
