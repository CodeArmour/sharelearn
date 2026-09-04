import Link from "next/link";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import type { InviteErrorCode } from "@/types";

const KEY: Record<
  InviteErrorCode,
  "expired" | "revoked" | "emailMismatch" | "alreadyMember" | "notFound"
> = {
  expired: "expired",
  revoked: "revoked",
  "email-mismatch": "emailMismatch",
  "already-member": "alreadyMember",
  "not-found": "notFound",
};

export function InviteOutcome({ code }: { code: InviteErrorCode }) {
  const t = useTranslations("auth.invite");
  const dest = code === "email-mismatch" ? "/login" : "/groups";
  const destLabel = code === "email-mismatch" ? t("toLogin") : t("toGroups");

  return (
    <div className="space-y-3 text-center">
      <p className="text-body text-fg">{t(`error.${KEY[code]}`)}</p>
      <Link href={dest} className={buttonVariants({ variant: "outline" })}>
        {destLabel}
      </Link>
    </div>
  );
}
