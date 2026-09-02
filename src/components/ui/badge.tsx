import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Badge — small status / metadata pill. Covers CEFR level chips, count badges
 * and knowledge-type tags. A dedicated `KnowledgeTypeBadge` will build on this
 * when the Library screen is implemented.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill font-sans text-label font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-fg-muted",
        info: "bg-info-subtle text-info-strong",
        success: "bg-success-subtle text-success-strong",
        warning: "bg-warning-subtle text-warning-strong",
        error: "bg-error-subtle text-error-strong",
        vocabulary: "bg-knowledge-vocabulary-subtle text-knowledge-vocabulary-strong",
        grammar: "bg-knowledge-grammar-subtle text-knowledge-grammar-strong",
        reading: "bg-knowledge-reading-subtle text-knowledge-reading-strong",
        file: "bg-knowledge-file-subtle text-knowledge-file-strong",
      },
      size: {
        sm: "px-1.5 py-0.5 text-caption",
        md: "px-2 py-1",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends ComponentPropsWithRef<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
