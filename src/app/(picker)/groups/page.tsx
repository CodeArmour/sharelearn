import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/server/auth/session";
import { getGroupsForPicker } from "@/server/services/group-service";
import { GroupPicker } from "@/features/groups/group-picker";
import { NoGroupAccess } from "@/features/groups/no-group-access";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("groups.picker.title"));

export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) {
    // middleware normally prevents this; be defensive.
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  const groups = await getGroupsForPicker();
  if (groups.length === 0) return <NoGroupAccess />;

  const t = await getTranslations("groups.picker");
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-h2 text-fg">{t("title")}</h1>
        <p className="text-body-sm text-fg-muted">{t("subtitle")}</p>
      </div>
      <GroupPicker groups={groups} />
    </div>
  );
}
