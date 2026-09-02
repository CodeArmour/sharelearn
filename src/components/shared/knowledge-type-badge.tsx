import { BookOpen, FileText, LayoutGrid, Library, type LucideIcon, StickyNote } from "lucide-react";

import type { KnowledgeType } from "@/types";
import { cn } from "@/lib/utils/cn";

/**
 * KnowledgeTypeBadge — the coloured pill identifying a knowledge item's type.
 * Maps to the Figma `KnowledgeTypeBadge` (Type × Size). Colours come from the
 * `knowledge/*` token family.
 */
const TYPE: Record<KnowledgeType, { label: string; icon: LucideIcon; className: string }> = {
  vocabulary: {
    label: "Vocabulary",
    icon: Library,
    className: "bg-knowledge-vocabulary-subtle text-knowledge-vocabulary-strong",
  },
  grammar: {
    label: "Grammar",
    icon: LayoutGrid,
    className: "bg-knowledge-grammar-subtle text-knowledge-grammar-strong",
  },
  reading: {
    label: "Reading",
    icon: BookOpen,
    className: "bg-knowledge-reading-subtle text-knowledge-reading-strong",
  },
  file: {
    label: "File",
    icon: FileText,
    className: "bg-knowledge-file-subtle text-knowledge-file-strong",
  },
  note: {
    label: "Note",
    icon: StickyNote,
    className: "bg-surface-sunken text-fg-secondary",
  },
};

export function KnowledgeTypeBadge({
  type,
  className,
}: {
  type: KnowledgeType;
  className?: string;
}) {
  const { label, icon: Icon, className: tone } = TYPE[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
      {label}
    </span>
  );
}
