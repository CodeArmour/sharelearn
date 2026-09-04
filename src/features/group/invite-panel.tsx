"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Section } from "@/components/layout";
import { Button, Input } from "@/components/ui";
import { formatDateShort } from "@/lib/utils/date";
import { inviteMemberAction, revokeInvitationAction } from "@/server/actions/invites";
import type { PendingInvite } from "@/types";

const ERROR_KEY: Record<string, "notOwner" | "alreadyInvited" | "invalidEmail"> = {
  forbidden: "notOwner",
  conflict: "alreadyInvited",
  validation: "invalidEmail",
};

export function InvitePanel({ pendingInvites }: { pendingInvites: PendingInvite[] }) {
  const t = useTranslations("group.settings.invite");
  const tErr = useTranslations("group.settings.errors");
  const locale = useLocale();

  const [state, formAction, pending] = useActionState(inviteMemberAction, undefined);
  const [, revokeAction, revoking] = useActionState(revokeInvitationAction, undefined);

  return (
    <Section title={t("sectionTitle")}>
      <form action={formAction} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            name="email"
            required
            aria-label={t("emailLabel")}
            placeholder={t("emailPlaceholder")}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={pending}>
            {t("submit")}
          </Button>
        </div>
        {state?.ok === true && (
          <p className="text-body-sm text-success-strong">
            {t("sent", { email: state.data.email })}
          </p>
        )}
        {state?.ok === false && (
          <p role="alert" className="text-body-sm text-error-strong">
            {tErr(ERROR_KEY[state.code] ?? "generic")}
          </p>
        )}
      </form>

      <div className="mt-4 space-y-2">
        <h3 className="text-body-sm font-medium text-fg-secondary">{t("pendingTitle")}</h3>
        {pendingInvites.length === 0 ? (
          <p className="text-body-sm text-fg-muted">{t("pendingEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface p-3"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{inv.email}</span>
                <span className="text-caption text-fg-muted">
                  {t("expires", { date: formatDateShort(inv.expiresAt, locale) })}
                </span>
                <form action={revokeAction}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <Button type="submit" variant="ghost" size="sm" disabled={revoking}>
                    {t("revoke")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
