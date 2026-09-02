import type { ReactNode } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui";

import type { FieldsProps } from "./types";

type Base = FieldsProps & {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
};

function describedBy(name: string, error?: string, hint?: string) {
  if (error) return `add-${name}-error`;
  if (hint) return `add-${name}-hint`;
  return undefined;
}

export function TextField({ name, label, values, errors, set, required, hint, placeholder }: Base) {
  const error = errors[name];
  return (
    <Field label={label} htmlFor={`add-${name}`} required={required} hint={hint} error={error}>
      <Input
        id={`add-${name}`}
        name={name}
        value={values[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
      />
    </Field>
  );
}

export function AreaField({
  name,
  label,
  values,
  errors,
  set,
  required,
  hint,
  placeholder,
  rows,
}: Base & { rows?: number }) {
  const error = errors[name];
  return (
    <Field label={label} htmlFor={`add-${name}`} required={required} hint={hint} error={error}>
      <Textarea
        id={`add-${name}`}
        name={name}
        rows={rows}
        value={values[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint)}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  values,
  set,
  children,
}: FieldsProps & { name: string; label: string; children: ReactNode }) {
  return (
    <Field label={label} htmlFor={`add-${name}`}>
      <Select
        id={`add-${name}`}
        name={name}
        value={values[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
      >
        {children}
      </Select>
    </Field>
  );
}
