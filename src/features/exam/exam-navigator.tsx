import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

export function ExamNavigator({
  count,
  current,
  answered,
  pinned,
  onJump,
}: {
  count: number;
  current: number;
  answered: boolean[];
  pinned: boolean[];
  onJump: (index: number) => void;
}) {
  const t = useTranslations("exam.session");

  return (
    <nav aria-label={t("navigatorTitle")} className="flex flex-col gap-3">
      <span className="text-label font-medium text-fg-secondary">{t("navigatorTitle")}</span>
      <ol className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === current ? "step" : undefined}
              onClick={() => onJump(i)}
              className={cn(
                "relative grid h-9 w-full place-items-center rounded-md text-body-sm font-medium transition-colors",
                answered[i]
                  ? "bg-primary text-on-primary"
                  : "bg-surface-sunken text-fg-muted hover:text-fg",
                i === current && "ring-2 ring-border-focus",
              )}
            >
              {i + 1}
              {pinned[i] ? (
                <Flag
                  className="absolute -right-1 -top-1 size-3 text-warning-strong"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
          {t("navigatorAnswered")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-surface-sunken" aria-hidden />
          {t("navigatorUnanswered")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag className="size-2.5 text-warning-strong" aria-hidden />
          {t("navigatorFlagged")}
        </span>
      </div>
    </nav>
  );
}
