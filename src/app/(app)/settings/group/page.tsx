import { getCurrentUser } from "@/server/auth/session";
import { getGroupSettings } from "@/server/services/group-service";
import { titleMetadata } from "@/lib/page-metadata";
import { GroupSettingsView } from "@/features/group";

export const generateMetadata = titleMetadata((t) => t("pages.group.title"));

export default async function GroupSettingsPage() {
  const [settings, user] = await Promise.all([getGroupSettings(), getCurrentUser()]);
  return <GroupSettingsView members={settings.members} currentUserId={user?.id ?? ""} />;
}
