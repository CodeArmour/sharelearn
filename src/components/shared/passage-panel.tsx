import { useTranslations } from "next-intl";

/**
 * The reading passage, shown once above the first question of each passage run
 * in both the practice session and the exam paper. The body box is a
 * keyboard-focusable scroll region so a long passage is reachable without a
 * mouse.
 */
export function PassagePanel({
  passage,
}: {
  passage: { id: string; title: string; body: string };
}) {
  const t = useTranslations("practice.session");
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface-sunken p-4">
      <span className="text-label text-fg-muted">{t("passageLabel")}</span>
      <p className="font-display text-h3 text-fg">{passage.title}</p>
      <div
        tabIndex={0}
        role="region"
        aria-label={passage.title}
        className="max-h-64 overflow-y-auto whitespace-pre-wrap text-body-sm text-fg-secondary"
      >
        {passage.body}
      </div>
    </div>
  );
}
