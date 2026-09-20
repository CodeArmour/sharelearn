"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Avatar, Button } from "@/components/ui";
import { ProfileForm } from "@/features/onboarding";
import type { ProfileFields } from "@/types";

export function EditProfileSection({
  initial,
  roleLabel,
  memberSinceLabel,
}: {
  initial: ProfileFields;
  roleLabel: string | null;
  memberSinceLabel: string | null;
}) {
  const t = useTranslations("profile.edit");
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <ProfileForm
          mode="edit"
          initial={initial}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-5">
      <Avatar avatar={initial.avatar} size="lg" />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-display text-h3 text-fg">{initial.nickname}</span>
        {roleLabel && memberSinceLabel ? (
          <span className="text-body-sm text-fg-muted">
            {roleLabel} · {memberSinceLabel}
          </span>
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        {t("editButton")}
      </Button>
    </div>
  );
}
