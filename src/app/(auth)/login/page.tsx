import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/navigation/brand-mark";
import { MagicLinkForm } from "@/features/auth/magic-link-form";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("login.welcome"));

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  await getTranslations("login"); // ensure the namespace is loaded for the client boundary
  const { invite } = await searchParams;
  const inviteToken = typeof invite === "string" ? invite : undefined;
  return (
    <div className="w-full max-w-sm space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
      <BrandMark />
      <MagicLinkForm inviteToken={inviteToken} />
    </div>
  );
}
