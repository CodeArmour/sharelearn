"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { switchActiveGroupAction } from "@/server/actions/groups";
import { Button } from "@/components/ui";
import type { GroupSummary } from "@/types";

export function GroupPicker({ groups }: { groups: GroupSummary[] }) {
  const t = useTranslations("groups.picker");
  const roleLabel = { owner: t("roleOwner"), member: t("roleMember") };
  const [, formAction, pending] = useActionState(switchActiveGroupAction, undefined);

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((g) => (
        <li key={g.id}>
          <form action={formAction}>
            <input type="hidden" name="groupId" value={g.id} />
            <Button
              type="submit"
              variant="outline"
              block
              disabled={pending}
              aria-label={t("continueIn", { name: g.name })}
              className="justify-between"
            >
              <span className="font-medium">{g.name}</span>
              <span className="text-caption text-fg-muted">{roleLabel[g.role]}</span>
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
