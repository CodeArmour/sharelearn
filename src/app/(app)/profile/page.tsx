import { redirect } from "next/navigation";

import { ProfileView } from "@/features/profile";
import { titleMetadata } from "@/lib/page-metadata";
import { getCurrentUser } from "@/server/auth/session";
import { getGroupSettings } from "@/server/services/group-service";
import { getLibraryStats } from "@/server/services/knowledge-service";
import { getStudyHistory } from "@/server/services/personal-service";
import { getProfileDetails } from "@/server/services/profile-service";

export const generateMetadata = titleMetadata((t) => t("pages.profile.title"));

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profileFields, settings, libraryStats, studyHistory] = await Promise.all([
    getProfileDetails(),
    getGroupSettings(),
    getLibraryStats(),
    getStudyHistory(10),
  ]);
  const member = settings.members.find((m) => m.id === user.id);

  return (
    <ProfileView
      profileFields={profileFields}
      member={member}
      libraryStats={libraryStats}
      studyHistory={studyHistory}
    />
  );
}
