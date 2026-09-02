import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("pages.profile.title"));

export default async function ProfilePage() {
  const t = await getTranslations("pages.profile");
  return <PlaceholderPage title={t("title")} description={t("subtitle")} />;
}
