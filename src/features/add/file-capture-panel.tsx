"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field } from "@/components/ui";

import { isSupportedCaptureFile, MAX_CAPTURE_FILE_BYTES, MAX_CAPTURE_FILES } from "./capture-files";

/** Pick up to three study attachments and send only validated files to the
 * parent. Images are optimized before upload; PDFs and Excel files go through
 * untouched for the AI provider's native file parsing. */
export function FileCapturePanel({
  onStructure,
  busy,
}: {
  onStructure: (files: File[]) => void;
  busy: boolean;
}) {
  const t = useTranslations("add.ai");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(picked)) {
      if (next.length >= MAX_CAPTURE_FILES) {
        setError(t("files.tooMany"));
        break;
      }
      if (!isSupportedCaptureFile(file)) {
        setError(t("files.rejectedFormat"));
        continue;
      }
      if (file.size > MAX_CAPTURE_FILE_BYTES) {
        setError(t("files.rejectedSize"));
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => setFiles((current) => current.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ai-border bg-ai-subtle p-4 sm:p-5">
      <Field label={t("files.pick")} htmlFor="file-capture">
        <input
          ref={inputRef}
          id="file-capture"
          type="file"
          accept="image/*,application/pdf,.pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          disabled={busy}
          onChange={(event) => add(event.target.files)}
          className="text-body-sm"
        />
      </Field>
      <p className="text-caption text-fg-muted">{t("files.hint")}</p>

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("files.selected")}>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-caption"
            >
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={t("removeAttachment")}
                disabled={busy}
                className="-mr-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-border-focus"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-caption text-error-strong" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          size="md"
          onClick={() => onStructure(files)}
          disabled={busy || files.length === 0}
        >
          <Sparkles className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("submit")}
        </Button>
        <p className="max-w-md text-caption text-fg-muted">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
