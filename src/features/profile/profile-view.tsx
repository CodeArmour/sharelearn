import { getLocale, getTranslations } from "next-intl/server";

import { PageContainer, PageHeader } from "@/components/layout";
import { formatDateShort } from "@/lib/utils/date";
import type { GroupMemberSummary, KnowledgeType, ProfileFields, StudyHistory } from "@/types";

import { EditProfileSection } from "./edit-profile-section";
import { PreferencesSection } from "./preferences-section";
import { ProgressSection } from "./progress-section";
import { ReviewListSection } from "./review-list-section";

export async function ProfileView({
  profileFields,
  member,
  libraryStats,
  studyHistory,
}: {
  profileFields: ProfileFields;
  member?: GroupMemberSummary;
  libraryStats: Record<KnowledgeType, number> & { total: number };
  studyHistory: StudyHistory;
}) {
  const [t, tPage, locale] = await Promise.all([
    getTranslations("profile"),
    getTranslations("pages.profile"),
    getLocale(),
  ]);

  const roleLabel = member
    ? { owner: t("role.owner"), member: t("role.member") }[member.role]
    : null;
  const memberSinceLabel = member
    ? t("memberSince", { date: formatDateShort(member.joinedAt, locale) })
    : null;

  return (
    <PageContainer>
      <PageHeader title={tPage("title")} description={tPage("subtitle")} />

      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-8">
        <EditProfileSection
          initial={profileFields}
          roleLabel={roleLabel}
          memberSinceLabel={memberSinceLabel}
        />

        <PreferencesSection />
        <ProgressSection libraryStats={libraryStats} history={studyHistory} />
        <ReviewListSection />
      </div>
    </PageContainer>
  );
}
