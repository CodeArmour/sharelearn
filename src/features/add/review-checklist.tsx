"use client";

import { useTranslations } from "next-intl";

import { Badge, Button } from "@/components/ui";

import { missingRequired } from "./suggestion-to-input";
import type { AuthableType, Example, Values } from "./types";

export type ReviewRow = {
  id: string;
  checked: boolean;
  type: AuthableType;
  values: Values;
  examples: Example[];
};

const VOCAB_EXTRAS = ["article", "plural", "pastTense", "perfect", "example", "usageNote"] as const;

function preview(row: ReviewRow): string {
  const v = row.values;
  switch (row.type) {
    case "vocabulary":
      return [v.term, v.meaning].filter(Boolean).join(" — ");
    case "grammar":
    case "reading":
      return v.title ?? "";
    case "note":
      return (v.title && v.title.trim()) || (v.noteBody ?? "").trim().slice(0, 60);
  }
}

export function ReviewChecklist({
  truncated,
  rows,
  onToggle,
  onToggleAll,
  onEdit,
  onRemove,
  onSubmit,
  submitting,
}: {
  truncated: boolean;
  rows: ReviewRow[];
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const t = useTranslations("add.ai.review");
  const tType = useTranslations("knowledge.type");
  const tPhotos = useTranslations("add.ai.photos");

  const selectedCount = rows.filter((r) => r.checked).length;
  const allSelectable = rows.filter((r) => missingRequired(r.type, r.values).length === 0);
  const allChecked = allSelectable.length > 0 && allSelectable.every((r) => r.checked);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label font-medium text-fg-secondary">{t("title")}</span>
        <label className="flex items-center gap-2 text-caption text-fg-muted">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => onToggleAll(e.target.checked)}
          />
          {t("selectAll")}
        </label>
      </div>

      {truncated ? (
        <p className="rounded-lg bg-warning-subtle p-3 text-body-sm text-warning-strong">
          {tPhotos("truncated")}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const missing = missingRequired(row.type, row.values);
          const needsDetails = missing.length > 0;
          const extras =
            row.type === "vocabulary"
              ? VOCAB_EXTRAS.filter((k) => (row.values[k] ?? "").trim().length > 0)
              : [];
          return (
            <li
              key={row.id}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={row.checked}
                disabled={needsDetails}
                onChange={() => onToggle(row.id)}
                aria-label={preview(row)}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.type === "note" ? "neutral" : row.type} size="sm">
                    {tType(row.type)}
                  </Badge>
                  <span className="truncate text-body-sm text-fg">{preview(row)}</span>
                </div>
                {extras.length > 0 ? (
                  <span className="text-caption text-fg-muted">
                    {t("extraFields", { fields: extras.join(", ") })}
                  </span>
                ) : null}
                {row.type === "grammar" ? (
                  <span className="text-caption text-fg-muted">
                    {t("exampleCount", { count: row.examples.length })}
                  </span>
                ) : null}
                {needsDetails ? (
                  <span className="text-caption font-medium text-warning-strong">
                    {t("needsDetails")}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row.id)}>
                  {t("edit")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(row.id)}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        size="md"
        onClick={onSubmit}
        disabled={selectedCount === 0 || submitting}
      >
        {t("submit", { count: selectedCount })}
      </Button>
    </div>
  );
}
