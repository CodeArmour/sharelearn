import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field, Textarea } from "@/components/ui";

/** Paste raw text and hand it to the AI structuring step. */
export function AiCaptureBox({
  value,
  onChange,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Scroll into view + focus on mount (arriving from Today's "add" shortcut). */
  autoFocus?: boolean;
  onSubmit: () => void;
}) {
  const t = useTranslations("add.ai");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) boxRef.current?.scrollIntoView({ block: "center" });
  }, [autoFocus]);

  return (
    <div
      ref={boxRef}
      className="flex flex-col gap-3 rounded-card border border-ai-border bg-ai-subtle p-4 sm:p-5"
    >
      <Field label={t("captureLabel")} htmlFor="ai-capture">
        <Textarea
          id="ai-capture"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("capturePlaceholder")}
          rows={4}
          className="bg-surface"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" size="md" onClick={onSubmit} disabled={value.trim().length === 0}>
          <Sparkles className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("submit")}
        </Button>
        <p className="max-w-md text-caption text-fg-muted">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
