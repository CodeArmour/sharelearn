import { ClipboardList, type LucideIcon, Target } from "lucide-react";

/**
 * Practice vs Exam visual identity, shared by the setup note and the results
 * card so a run reads as the same mode from start to finish: a calm blue for
 * practice, a serious amber ("this counts") for exam.
 */
export const MODE_ACCENT: Record<
  "practice" | "exam",
  { card: string; text: string; Icon: LucideIcon }
> = {
  practice: {
    card: "border-info-strong/20 bg-info-subtle",
    text: "text-info-strong",
    Icon: Target,
  },
  exam: {
    card: "border-warning-strong/25 bg-warning-subtle",
    text: "text-warning-strong",
    Icon: ClipboardList,
  },
};
