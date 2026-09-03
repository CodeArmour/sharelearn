import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui";

/**
 * The "capture is never blocked" fallback — shown when the AI step returns
 * nothing usable. Both actions lead back to a working form.
 */
export function AiFailedPanel({
  onFillManually,
  onCancel,
}: {
  onFillManually: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("add.ai");
  const tc = useTranslations("common");

  return (
    <div className="flex flex-col gap-4 rounded-card border border-warning bg-warning-subtle p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert
          className="mt-0.5 size-5 shrink-0 text-warning-strong"
          strokeWidth={2}
          aria-hidden
        />
        <div className="flex flex-col gap-1">
          <p className="font-display text-h3 text-warning-strong">{t("failedTitle")}</p>
          <p className="text-body-sm text-fg-secondary">{t("failedBody")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pl-8">
        <Button type="button" size="md" onClick={onFillManually}>
          {t("fillManually")}
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}
