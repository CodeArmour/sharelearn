import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("pages.exam.title"));

export default async function ExamPage() {
  const t = await getTranslations("pages.exam");
  return <PlaceholderPage title={t("title")} description={t("subtitle")} />;
}
