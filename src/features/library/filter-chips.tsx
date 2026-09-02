import Link from "next/link";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { type KnowledgeType, KNOWLEDGE_TYPES } from "@/types";
import { cn } from "@/lib/utils/cn";

/** Type filter as pill links. Maps to the Figma `type-filter` chips. */
export async function FilterChips({
  active,
  hrefFor,
}: {
  active?: KnowledgeType;
  hrefFor: (type?: KnowledgeType) => string;
}) {
  const t = await getTranslations("library.filter");
  const chips: { key: string; label: string; type?: KnowledgeType }[] = [
    { key: "all", label: t("all") },
    ...KNOWLEDGE_TYPES.filter((type) => type !== "note").map((type) => ({
      key: type,
      label: t(type as "vocabulary" | "grammar" | "reading" | "file"),
      type,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const isActive = chip.type === active || (!chip.type && !active);
        return (
          <Link
            key={chip.key}
            href={hrefFor(chip.type)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-pill border px-3 text-body-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
              isActive
                ? "border-primary bg-primary-subtle text-primary-hover"
                : "border-border-default bg-surface text-fg-secondary hover:bg-surface-interactive-hover",
            )}
          >
            {isActive && <Check className="size-3.5" strokeWidth={2} aria-hidden />}
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
