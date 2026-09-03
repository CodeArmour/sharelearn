import { getCurrentUser, getGroupMembers, getLibraryStats } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";
import { ProfileView } from "@/features/profile";

export const generateMetadata = titleMetadata((t) => t("pages.profile.title"));

export default async function ProfilePage() {
  const [user, members, libraryStats] = await Promise.all([
    getCurrentUser(),
    getGroupMembers(),
    getLibraryStats(),
  ]);
  const member = members.find((m) => m.id === user.id);

  return <ProfileView user={user} member={member} libraryStats={libraryStats} />;
}
