import { ClipboardList, Target } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

type Mode = "practice" | "exam";

const STYLE: Record<Mode, { card: string; accent: string; Icon: typeof Target }> = {
  practice: {
    card: "border-info-strong/20 bg-info-subtle",
    accent: "text-info-strong",
    Icon: Target,
  },
  exam: {
    card: "border-warning-strong/25 bg-warning-subtle",
    accent: "text-warning-strong",
    Icon: ClipboardList,
  },
};

/**
 * Sets Practice and Exam setup apart at a glance: an accent-tinted card naming
 * the mode and spelling out how it behaves (feedback timing, retries, scoring),
 * so nobody starts an exam thinking it's practice.
 */
export function SetupModeNote({ mode }: { mode: Mode }) {
  const t = useTranslations(mode === "exam" ? "exam.setup.about" : "practice.setup.about");
  const { card, accent, Icon } = STYLE[mode];
  const points = t.raw("points") as string[];

  return (
    <div className={cn("rounded-card border p-4", card)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", accent)} strokeWidth={2} aria-hidden />
        <p className={cn("text-label font-medium", accent)}>{t("title")}</p>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-body-sm text-fg-secondary">
            <span
              className={cn("mt-2 size-1 shrink-0 rounded-full bg-current", accent)}
              aria-hidden
            />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
