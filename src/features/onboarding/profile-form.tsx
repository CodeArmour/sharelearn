"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Field, Input, Select } from "@/components/ui";
import { completeOnboardingAction, updateProfileAction } from "@/server/actions/profile";
import { CEFR_LEVELS, LEARNING_GOALS, type AvatarConfig, type ProfileFields } from "@/types";

import { AvatarBuilder } from "./avatar-builder";

/** Shared by /onboarding (mode="onboarding") and the /profile edit view
 * (mode="edit"). Field labels always come from the "onboarding" namespace
 * since the form is identical in both places. */
export function ProfileForm({
  mode,
  initial,
  onSaved,
}: {
  mode: "onboarding" | "edit";
  initial: ProfileFields;
  onSaved?: () => void;
}) {
  const t = useTranslations("onboarding");
  const action = mode === "onboarding" ? completeOnboardingAction : updateProfileAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [avatar, setAvatar] = useState<AvatarConfig>(initial.avatar);

  useEffect(() => {
    if (mode === "edit" && state?.ok === true) onSaved?.();
  }, [state, mode, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="avatar" value={JSON.stringify(avatar)} />

      <AvatarBuilder
        value={avatar}
        onChange={setAvatar}
        stickyTop={
          // In edit mode the app's MobileTopBar (h-14 + border + safe-area inset)
          // is itself sticky, so the preview must stick beneath it.
          mode === "edit" ? "top-[calc(3.5rem+1px+env(safe-area-inset-top))]" : "top-0"
        }
      />

      <Field label={t("fullNameLabel")} htmlFor="profile-full-name" required>
        <Input id="profile-full-name" name="fullName" defaultValue={initial.fullName} required />
      </Field>
      <Field label={t("nicknameLabel")} htmlFor="profile-nickname" required>
        <Input id="profile-nickname" name="nickname" defaultValue={initial.nickname} required />
      </Field>
      <Field label={t("cefrLabel")} htmlFor="profile-cefr">
        <Select id="profile-cefr" name="cefrLevel" defaultValue={initial.cefrLevel ?? ""}>
          <option value="">{t("cefrNone")}</option>
          {CEFR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("learningGoalLabel")} htmlFor="profile-goal">
        <Select id="profile-goal" name="learningGoal" defaultValue={initial.learningGoal ?? ""}>
          <option value="">{t("learningGoalNone")}</option>
          {LEARNING_GOALS.map((goal) => (
            <option key={goal} value={goal}>
              {t(`learningGoalOptions.${goal}`)}
            </option>
          ))}
        </Select>
      </Field>

      {state?.ok === false ? (
        <p role="alert" className="text-body-sm text-error-strong">
          {state.message}
        </p>
      ) : null}
      {mode === "edit" && state?.ok === true ? (
        <p className="text-body-sm text-success-strong">{t("saved")}</p>
      ) : null}

      <Button type="submit" disabled={pending} block>
        {t(mode === "onboarding" ? "submit" : "save")}
      </Button>
    </form>
  );
}
