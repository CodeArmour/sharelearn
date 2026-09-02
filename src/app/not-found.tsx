import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-display text-display text-fg-muted">{t("code")}</p>
        <h1 className="font-display text-h2 text-fg">{t("title")}</h1>
        <p className="text-body text-fg-muted">{t("body")}</p>
        <Link href="/today" className={buttonVariants()}>
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
