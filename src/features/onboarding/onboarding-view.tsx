import { getTranslations } from "next-intl/server";

import type { AvatarConfig, ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

export async function OnboardingView({ avatar }: { avatar: AvatarConfig }) {
  const t = await getTranslations("onboarding");

  const initial: ProfileFields = {
    fullName: "",
    nickname: "",
    avatar,
    cefrLevel: null,
    learningGoal: null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-h2 text-fg">{t("title")}</h1>
        <p className="text-body-sm text-fg-muted">{t("subtitle")}</p>
      </div>
      <ProfileForm mode="onboarding" initial={initial} />
    </div>
  );
}
