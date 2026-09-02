import { Download, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { FileItem } from "@/types";
import { Button, buttonVariants } from "@/components/ui";
import { formatFileSize } from "@/lib/utils/file-size";

/**
 * Full detail for an uploaded file. Download stays disabled until a storage
 * backend exists (`url` is always null in the mock layer).
 */
export async function FileDetail({ item }: { item: FileItem }) {
  const t = await getTranslations("knowledge.detail");
  const ext = item.fileName.split(".").pop()?.toUpperCase() ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-subtle p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-knowledge-file-subtle text-knowledge-file-strong">
          {ext ? (
            <span className="text-caption font-semibold">{ext}</span>
          ) : (
            <FileText className="size-6" strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-medium break-all text-fg">{item.fileName}</span>
          <span className="text-body-sm text-fg-muted">
            {[ext || item.mimeType, formatFileSize(item.sizeBytes)].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      {item.note ? <p className="text-body text-fg-secondary">{item.note}</p> : null}

      {item.extractedCount != null ? (
        <p className="text-body-sm text-fg-muted">
          {t("file.extracted", { count: item.extractedCount })}
        </p>
      ) : null}

      {item.url ? (
        <a
          href={item.url}
          download
          className={buttonVariants({ variant: "outline", size: "md" })}
        >
          <Download className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("file.download")}
        </a>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span>
            <Button variant="outline" disabled>
              <Download className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
              {t("file.download")}
            </Button>
          </span>
          <p className="text-body-sm text-fg-muted">{t("file.unavailable")}</p>
        </div>
      )}
    </div>
  );
}
