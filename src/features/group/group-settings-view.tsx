import { getLocale, getTranslations } from "next-intl/server";

import { PageContainer, PageHeader } from "@/components/layout";
import { Avatar, Badge } from "@/components/ui";
import { formatDateShort } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import type { GroupSettingsView as GroupSettingsViewData } from "@/types";

import { InvitePanel } from "./invite-panel";

export async function GroupSettingsView({ settings }: { settings: GroupSettingsViewData }) {
  const [t, tPage, tMembers, locale] = await Promise.all([
    getTranslations("group"),
    getTranslations("pages.group"),
    getTranslations("group.settings.members"),
    getLocale(),
  ]);

  const roleLabel = { owner: tMembers("roleOwner"), member: tMembers("roleMember") };
  const sorted = [...settings.members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
  const isOwner = settings.viewerRole === "owner";

  return (
    <PageContainer>
      <PageHeader
        title={tPage("title")}
        description={tPage("subtitle", { count: settings.members.length })}
      />

      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-8">
        <ul className="flex flex-col gap-2">
          {sorted.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-surface p-3",
                m.role === "owner" ? "border-border-default" : "border-border",
              )}
            >
              <Avatar initials={m.initials} accent={m.accent} size="md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-fg">{m.name}</span>
                <span className="truncate text-body-sm text-fg-muted">
                  {t("joined", { date: formatDateShort(m.joinedAt, locale) })}
                </span>
              </div>
              <Badge tone={m.role === "owner" ? "info" : "neutral"} size="sm">
                {roleLabel[m.role]}
              </Badge>
            </li>
          ))}
        </ul>

        {isOwner && <InvitePanel pendingInvites={settings.pendingInvites} />}

        <p className="text-body-sm text-fg-muted">{t("manageNote")}</p>
      </div>
    </PageContainer>
  );
}
