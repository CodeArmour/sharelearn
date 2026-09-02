import { BookOpen, FileText, LayoutGrid, Library, type LucideIcon, StickyNote } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { KnowledgeType } from "@/types";
import { cn } from "@/lib/utils/cn";

/**
 * KnowledgeTypeBadge — the coloured pill identifying a knowledge item's type.
 * Maps to the Figma `KnowledgeTypeBadge`. Colours from the `knowledge/*` token
 * family; label from the `knowledge.type` message namespace (so it follows the
 * UI language — the practice toggle flips these too).
 */
const TYPE: Record<KnowledgeType, { icon: LucideIcon; className: string }> = {
  vocabulary: {
    icon: Library,
    className: "bg-knowledge-vocabulary-subtle text-knowledge-vocabulary-strong",
  },
  grammar: {
    icon: LayoutGrid,
    className: "bg-knowledge-grammar-subtle text-knowledge-grammar-strong",
  },
  reading: {
    icon: BookOpen,
    className: "bg-knowledge-reading-subtle text-knowledge-reading-strong",
  },
  file: {
    icon: FileText,
    className: "bg-knowledge-file-subtle text-knowledge-file-strong",
  },
  note: {
    icon: StickyNote,
    className: "bg-surface-sunken text-fg-secondary",
  },
};

export async function KnowledgeTypeBadge({
  type,
  className,
}: {
  type: KnowledgeType;
  className?: string;
}) {
  const t = await getTranslations("knowledge.type");
  const { icon: Icon, className: tone } = TYPE[type];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
      {t(type)}
    </span>
  );
}
