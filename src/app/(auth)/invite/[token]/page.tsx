import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/navigation/brand-mark";
import { InviteOutcome } from "@/features/auth/invite-outcome";
import { getSession } from "@/server/auth/session";
import { InviteError } from "@/server/errors";
import { acceptInvitation } from "@/server/services/invite-service";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!(await getSession())) {
    redirect("/login");
  }

  try {
    await acceptInvitation({ token });
  } catch (e) {
    if (e instanceof InviteError) {
      const t = await getTranslations("auth.invite");
      return (
        <div className="w-full max-w-sm space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
          <BrandMark />
          <h1 className="font-display text-h2 text-fg">{t("acceptingTitle")}</h1>
          <InviteOutcome code={e.inviteCode} />
        </div>
      );
    }
    throw e;
  }

  redirect("/today");
}
