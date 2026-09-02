import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/navigation/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("login.welcome"));

/**
 * Login placeholder. No authentication backend yet — this route exists so the
 * `(auth)` segment and unauthenticated layout are in place.
 */
export default async function LoginPage() {
  const t = await getTranslations("login");

  return (
    <div className="w-full max-w-sm space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
      <BrandMark />
      <div className="space-y-1">
        <h1 className="font-display text-h2 text-fg">{t("welcome")}</h1>
        <p className="text-body-sm text-fg-muted">{t("subtitle")}</p>
      </div>
      <Link href="/today" className={buttonVariants({ block: true })}>
        {t("continueDemo")}
      </Link>
      <p className="text-caption text-fg-muted">{t("note")}</p>
    </div>
  );
}
