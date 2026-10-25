import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field, Textarea } from "@/components/ui";

import { FileCapturePanel } from "./file-capture-panel";

/** Hand raw study material to the AI structuring step: paste text, or (when
 *  `filesEnabled`) switch to a file mode that uploads 1–3 files instead. */
export function AiCaptureBox({
  value,
  onChange,
  autoFocus,
  onSubmit,
  filesEnabled = false,
  onStructureFiles,
  filesBusy = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Scroll into view + focus on mount (arriving from Today's "add" shortcut). */
  autoFocus?: boolean;
  onSubmit: () => void;
  filesEnabled?: boolean;
  onStructureFiles?: (files: File[]) => void;
  filesBusy?: boolean;
}) {
  const t = useTranslations("add.ai");
  const boxRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"text" | "files">("text");

  useEffect(() => {
    if (autoFocus) boxRef.current?.scrollIntoView({ block: "center" });
  }, [autoFocus]);

  const textPanel = (
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

  if (!filesEnabled || !onStructureFiles) return textPanel;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-pill bg-surface-sunken p-1 text-label">
        <button
          type="button"
          onClick={() => setTab("text")}
          aria-pressed={tab === "text"}
          disabled={filesBusy}
          className={
            tab === "text"
              ? "rounded-pill bg-surface px-3 py-1 font-medium"
              : "px-3 py-1 text-fg-muted"
          }
        >
          {t("mode.text")}
        </button>
        <button
          type="button"
          onClick={() => setTab("files")}
          aria-pressed={tab === "files"}
          disabled={filesBusy}
          className={
            tab === "files"
              ? "rounded-pill bg-surface px-3 py-1 font-medium"
              : "px-3 py-1 text-fg-muted"
          }
        >
          {t("mode.files")}
        </button>
      </div>
      {tab === "text" ? (
        textPanel
      ) : (
        <FileCapturePanel onStructure={onStructureFiles} busy={filesBusy} />
      )}
    </div>
  );
}
