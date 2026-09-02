import Link from "next/link";
import { Plus } from "lucide-react";

import { ADD_ACTION } from "@/lib/config/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * "+ Toevoegen" — the primary capture action. Rendered as the full-width button
 * in the desktop sidebar; the mobile bottom bar uses `AddKnowledgeFab`.
 */
export function AddKnowledgeButton({ className }: { className?: string }) {
  return (
    <Link
      href={ADD_ACTION.href}
      className={cn(buttonVariants({ variant: "primary", size: "md", block: true }), className)}
    >
      <Plus className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
      {ADD_ACTION.label}
    </Link>
  );
}

/** Raised circular capture action for the mobile bottom bar. */
export function AddKnowledgeFab({ className }: { className?: string }) {
  return (
    <Link
      href={ADD_ACTION.href}
      aria-label={ADD_ACTION.label}
      className={cn(
        "grid size-14 place-items-center rounded-pill bg-primary text-on-primary shadow-elevated",
        "transition-colors hover:bg-primary-hover",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        className,
      )}
    >
      <Plus className="size-6" strokeWidth={2} aria-hidden />
    </Link>
  );
}
