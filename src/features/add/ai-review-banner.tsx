import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/** Header for the AI review step — the reviewer edits freely below this. */
export function AiReviewBanner({
  noticeKey,
  truncated,
}: {
  noticeKey?: string;
  truncated?: boolean;
}) {
  const t = useTranslations("add.ai");
  // noticeKey is a controlled set of `add.ai.notice.*` keys; cast past the
  // literal-key type the same way the rest of this feature does.
  const notice = noticeKey ? t(`notice.${noticeKey}` as Parameters<typeof t>[0]) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-ai-border bg-ai-subtle p-4">
      <span className="inline-flex items-center gap-1.5 text-label font-medium text-ai">
        <Sparkles className="size-4" strokeWidth={2} aria-hidden />
        {t("reviewTitle")}
      </span>
      {truncated ? (
        <p className="text-body-sm text-warning-strong">{t("photos.truncated")}</p>
      ) : null}
      {notice ? <p className="text-body-sm text-fg-secondary">{notice}</p> : null}
    </div>
  );
}
