import Link from "next/link";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui";

/**
 * Post-submit confirmation. Deliberately does not claim the item was persisted —
 * there is no backend yet — but shows the capture succeeded and what to do next.
 */
export function SuccessPanel({ title, onAddAnother }: { title: string; onAddAnother: () => void }) {
  const t = useTranslations("add.saved");

  return (
    <div className="flex flex-col gap-4 rounded-card border border-success bg-success-subtle p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill bg-success text-on-primary">
          <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-display text-h3 text-success-strong">{t("title", { title })}</p>
          <p className="text-body-sm text-fg-secondary">{t("body")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pl-8">
        <Button type="button" variant="secondary" size="md" onClick={onAddAnother}>
          {t("addAnother")}
        </Button>
        <Link href="/library" className={buttonVariants({ variant: "outline", size: "md" })}>
          {t("toLibrary")}
        </Link>
      </div>
    </div>
  );
}
