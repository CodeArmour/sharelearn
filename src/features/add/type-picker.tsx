import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

import { PICKER_TYPES, type PickerType } from "./types";

/** Segmented control choosing which kind of knowledge to capture. */
export function TypePicker({
  value,
  onChange,
}: {
  value: PickerType;
  onChange: (value: PickerType) => void;
}) {
  const t = useTranslations("add");
  const tType = useTranslations("knowledge.type");

  return (
    <div
      role="group"
      aria-label={t("typeLabel")}
      className="flex flex-wrap gap-0.5 rounded-md bg-surface-sunken p-0.5"
    >
      {PICKER_TYPES.map((pt) => (
        <button
          key={pt}
          type="button"
          aria-pressed={value === pt}
          onClick={() => onChange(pt)}
          className={cn(
            "rounded-sm px-3 py-1.5 text-body-sm font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
            value === pt ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
          )}
        >
          {tType(pt)}
        </button>
      ))}
    </div>
  );
}
