import { getLocale, getTranslations } from "next-intl/server";

import type { GroupMemberSummary, KnowledgeType, UserSummary } from "@/types";
import { formatDateShort } from "@/lib/utils/date";
import { PageContainer, PageHeader } from "@/components/layout";
import { Avatar } from "@/components/ui";

import { PreferencesSection } from "./preferences-section";
import { ProgressSection } from "./progress-section";
import { ReviewListSection } from "./review-list-section";

export async function ProfileView({
  user,
  member,
  libraryStats,
}: {
  user: UserSummary;
  member?: GroupMemberSummary;
  libraryStats: Record<KnowledgeType, number> & { total: number };
}) {
  const [t, tPage, locale] = await Promise.all([
    getTranslations("profile"),
    getTranslations("pages.profile"),
    getLocale(),
  ]);

  const roleLabel = member
    ? { owner: t("role.owner"), member: t("role.member") }[member.role]
    : null;

  return (
    <PageContainer>
      <PageHeader title={tPage("title")} description={tPage("subtitle")} />

      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-8">
        <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-5">
          <Avatar initials={user.initials} accent={user.accent} size="lg" />
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-h3 text-fg">{user.name}</span>
            {member ? (
              <span className="text-body-sm text-fg-muted">
                {roleLabel} ·{" "}
                {t("memberSince", { date: formatDateShort(member.joinedAt, locale) })}
              </span>
            ) : null}
          </div>
        </div>

        <PreferencesSection />
        <ProgressSection libraryStats={libraryStats} />
        <ReviewListSection />
      </div>
    </PageContainer>
  );
}
