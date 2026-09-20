import { redirect } from "next/navigation";

import { OnboardingView } from "@/features/onboarding";
import { titleMetadata } from "@/lib/page-metadata";
import { getCurrentUser } from "@/server/auth/session";
import { getProfile } from "@/server/repositories/profiles";

export const generateMetadata = titleMetadata((t) => t("onboarding.title"));

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (profile?.onboardedAt) redirect("/today");

  return <OnboardingView />;
}
