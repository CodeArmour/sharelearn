import { getCurrentUser, getGroupMembers } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";
import { GroupSettingsView } from "@/features/group";

export const generateMetadata = titleMetadata((t) => t("pages.group.title"));

export default async function GroupSettingsPage() {
  const [members, user] = await Promise.all([getGroupMembers(), getCurrentUser()]);
  return <GroupSettingsView members={members} currentUserId={user.id} />;
}
