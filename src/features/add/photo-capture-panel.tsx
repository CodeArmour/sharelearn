"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field } from "@/components/ui";

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;

function isImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  return ext === "heic" || ext === "heif";
}

/** Pick 1–3 photos, validate size/type, hand the accepted `File[]` up. The
 *  parent view downscales, uploads to Storage, and calls the extract action. */
export function PhotoCapturePanel({
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
      if (next.length >= MAX_FILES) {
        setError(t("photos.tooMany"));
        break;
      }
      if (!isImage(file)) {
        setError(t("photos.rejectedFormat"));
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(t("photos.rejectedSize"));
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (i: number) => setFiles((f) => f.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ai-border bg-ai-subtle p-4 sm:p-5">
      <Field label={t("photos.pick")} htmlFor="photo-capture">
        <input
          ref={inputRef}
          id="photo-capture"
          type="file"
          multiple
          disabled={busy}
          onChange={(e) => add(e.target.files)}
          className="text-body-sm"
        />
      </Field>
      <p className="text-caption text-fg-muted">{t("photos.hint")}</p>

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-caption"
            >
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t("removeAttachment")}
                disabled={busy}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-caption text-error-strong">{error}</p> : null}

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
