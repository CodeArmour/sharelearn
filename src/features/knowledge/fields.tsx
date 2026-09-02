import type { ReactNode } from "react";

/**
 * Label / value pairs for the structured parts of a knowledge item
 * (vocabulary forms, file metadata). Stacks on mobile, two columns from `sm`.
 */
export function FieldList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-3">{children}</dl>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-label text-fg-muted sm:w-32 sm:shrink-0 sm:pt-0.5">{label}</dt>
      <dd className="text-body text-fg">{children}</dd>
    </div>
  );
}
