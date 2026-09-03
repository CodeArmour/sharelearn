import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/** Header for the AI review step — the reviewer edits freely below this. */
export function AiReviewBanner({ notice }: { notice?: string }) {
  const t = useTranslations("add.ai");

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-ai-border bg-ai-subtle p-4">
      <span className="inline-flex items-center gap-1.5 text-label font-medium text-ai">
        <Sparkles className="size-4" strokeWidth={2} aria-hidden />
        {t("reviewTitle")}
      </span>
      {notice ? <p className="text-body-sm text-fg-secondary">{notice}</p> : null}
    </div>
  );
}
