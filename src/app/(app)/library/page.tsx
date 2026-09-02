import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getLibraryStats } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("nav.library"));

export default async function LibraryPage() {
  const [stats, t] = await Promise.all([getLibraryStats(), getTranslations()]);
  return (
    <PlaceholderPage
      title={t("nav.library")}
      description={t("pages.library.subtitle", { count: stats.total })}
      note={t("pages.library.note")}
    />
  );
}
