"use client";

import { useTranslations } from "next-intl";

import { signOut } from "@/server/actions/auth";
import { Button } from "@/components/ui";

export function NoGroupAccess() {
  const t = useTranslations("groups.noAccess");
  return (
    <div className="space-y-3 text-center">
      <h1 className="font-display text-h2 text-fg">{t("title")}</h1>
      <p className="text-body-sm text-fg-muted">{t("body")}</p>
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          {t("signOut")}
        </Button>
      </form>
    </div>
  );
}
