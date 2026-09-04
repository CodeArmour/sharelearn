import { getGroupSettings } from "@/server/services/group-service";
import { titleMetadata } from "@/lib/page-metadata";
import { GroupSettingsView } from "@/features/group";

export const generateMetadata = titleMetadata((t) => t("pages.group.title"));

export default async function GroupSettingsPage() {
  const settings = await getGroupSettings();
  return <GroupSettingsView settings={settings} />;
}
