import { type ChangeEvent, useRef } from "react";
import { Camera, FileText, ImageIcon, Paperclip, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field, Textarea } from "@/components/ui";
import { formatFileSize } from "@/lib/utils/file-size";

import { type AiAttachment, classifyAttachment } from "./types";

/** Paste raw text — or attach a photo / file — and hand it to the (simulated) AI structuring step. */
export function AiCaptureBox({
  value,
  onChange,
  attachment,
  onAttachmentChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  attachment: AiAttachment | null;
  onAttachmentChange: (attachment: AiAttachment | null) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("add.ai");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after removing it
    if (!file) return;
    const next = classifyAttachment(file);
    if (next) onAttachmentChange(next);
  };

  const canSubmit = value.trim().length > 0 || attachment !== null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ai-border bg-ai-subtle p-4 sm:p-5">
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

      {/* Photo capture opens the camera on a phone; the file picker is broader. */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,text/plain,.md,.markdown"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFile}
      />

      {attachment ? (
        <AttachmentChip
          attachment={attachment}
          removeLabel={t("removeAttachment")}
          onRemove={() => onAttachmentChange(null)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera className="-ml-0.5 size-4" strokeWidth={1.75} aria-hidden />
            {t("attachPhoto")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="-ml-0.5 size-4" strokeWidth={1.75} aria-hidden />
            {t("attachFile")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" size="md" onClick={onSubmit} disabled={!canSubmit}>
          <Sparkles className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("submit")}
        </Button>
        <p className="max-w-md text-caption text-fg-muted">{t("disclaimer")}</p>
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  removeLabel,
  onRemove,
}: {
  attachment: AiAttachment;
  removeLabel: string;
  onRemove: () => void;
}) {
  const Icon = attachment.kind === "image" ? ImageIcon : FileText;

  return (
    <div className="flex w-fit max-w-full items-center gap-2 rounded-md border border-border bg-surface py-1.5 pr-1.5 pl-2.5 text-body-sm">
      <Icon className="size-4 shrink-0 text-fg-muted" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 truncate font-medium text-fg">{attachment.name}</span>
      <span className="shrink-0 text-caption text-fg-muted">{formatFileSize(attachment.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
      >
        <X className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
