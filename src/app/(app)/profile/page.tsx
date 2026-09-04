import { redirect } from "next/navigation";

import { getLibraryStats } from "@/server/services/knowledge-service";
import { getCurrentUser } from "@/server/auth/session";
import { getGroupSettings } from "@/server/services/group-service";
import { titleMetadata } from "@/lib/page-metadata";
import { ProfileView } from "@/features/profile";

export const generateMetadata = titleMetadata((t) => t("pages.profile.title"));

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [settings, libraryStats] = await Promise.all([getGroupSettings(), getLibraryStats()]);
  const member = settings.members.find((m) => m.id === user.id);

  return <ProfileView user={user} member={member} libraryStats={libraryStats} />;
}
