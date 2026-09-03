import { getLocale, getTranslations } from "next-intl/server";

import type { GroupMemberSummary } from "@/types";
import { formatDateShort } from "@/lib/utils/date";
import { PageContainer, PageHeader, Section } from "@/components/layout";
import { Avatar, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export async function GroupSettingsView({
  members,
  currentUserId,
}: {
  members: GroupMemberSummary[];
  currentUserId: string;
}) {
  const [t, tPage, tRole, locale] = await Promise.all([
    getTranslations("group"),
    getTranslations("pages.group"),
    getTranslations("profile.role"),
    getLocale(),
  ]);

  const roleLabel = { owner: tRole("owner"), member: tRole("member") };
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });

  return (
    <PageContainer>
      <PageHeader
        title={tPage("title")}
        description={tPage("subtitle", { count: members.length })}
      />

      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-8">
        <ul className="flex flex-col gap-2">
          {sorted.map((m) => {
            const isYou = m.id === currentUserId;
            return (
              <li
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-surface p-3",
                  m.role === "owner" ? "border-border-default" : "border-border",
                )}
              >
                <Avatar initials={m.initials} accent={m.accent} size="md" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-fg">
                    {isYou ? `${m.name} (${t("you")})` : m.name}
                  </span>
                  <span className="truncate text-body-sm text-fg-muted">
                    {t("joined", { date: formatDateShort(m.joinedAt, locale) })}
                  </span>
                </div>
                <Badge tone={m.role === "owner" ? "info" : "neutral"} size="sm">
                  {roleLabel[m.role]}
                </Badge>
              </li>
            );
          })}
        </ul>

        <Section title={t("invite.title")}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder={t("invite.placeholder")}
                disabled
                className="sm:flex-1"
              />
              <Button type="button" disabled>
                {t("invite.send")}
              </Button>
            </div>
            <p className="text-caption text-fg-muted">{t("invite.note")}</p>
          </div>
        </Section>

        <p className="text-body-sm text-fg-muted">{t("manageNote")}</p>
      </div>
    </PageContainer>
  );
}
