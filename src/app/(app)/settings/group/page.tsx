import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getGroupMembers } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("pages.group.title"));

export default async function GroupSettingsPage() {
  const [members, t] = await Promise.all([getGroupMembers(), getTranslations()]);
  return (
    <PlaceholderPage
      title={t("pages.group.title")}
      description={t("pages.group.subtitle", { count: members.length })}
      note={t("pages.group.note")}
    />
  );
}
