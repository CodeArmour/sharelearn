import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("nav.add"));

export default async function AddKnowledgePage() {
  const t = await getTranslations("pages.add");
  return <PlaceholderPage title={t("title")} description={t("subtitle")} />;
}
