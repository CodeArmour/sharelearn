import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("pages.practice.title"));

export default async function PracticePage() {
  const t = await getTranslations("pages.practice");
  return <PlaceholderPage title={t("title")} description={t("subtitle")} />;
}
