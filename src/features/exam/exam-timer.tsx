import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

const WARN_MS = 5 * 60_000;

/** The exam countdown, shown as mm:ss. Turns to a warning colour in the last 5 minutes. */
export function ExamTimer({ remainingMs }: { remainingMs: number }) {
  const t = useTranslations("exam.session");
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  return (
    <span
      aria-label={t("timeLeft")}
      className={cn(
        "font-display text-h3 tabular-nums",
        remainingMs < WARN_MS ? "text-error-strong" : "text-fg",
      )}
    >
      {mm}:{ss}
    </span>
  );
}
