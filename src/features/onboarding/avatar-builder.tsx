"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { AVATAR_CHARACTER_COMPONENTS } from "@/components/ui/avatar-characters";
import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import { cn } from "@/lib/utils/cn";
import {
  AVATAR_CHARACTERS,
  BACKGROUND_COLORS,
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
  type AvatarConfig,
  type BackgroundColorId,
  type HairColorId,
  type ShirtColorId,
  type SkinColorId,
} from "@/types";

function SwatchRow<Id extends string>({
  label,
  ids,
  hexes,
  value,
  onChange,
}: {
  label: string;
  ids: readonly Id[];
  hexes: Record<Id, string>;
  value: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-medium text-fg-secondary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            aria-label={id}
            className={cn(
              "size-8 rounded-pill border-2",
              value === id ? "border-border-focus" : "border-transparent",
            )}
            style={{ backgroundColor: hexes[id] }}
          />
        ))}
      </div>
    </div>
  );
}

export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  const t = useTranslations("onboarding.avatar");
  const Character = AVATAR_CHARACTER_COMPONENTS[value.character];
  const previewStyle = {
    "--avatar-bg": BACKGROUND_COLOR_HEX[value.backgroundColor],
    "--avatar-hair": HAIR_COLOR_HEX[value.hairColor],
    "--avatar-shirt": SHIRT_COLOR_HEX[value.shirtColor],
    "--avatar-skin": SKIN_COLOR_HEX[value.skinColor],
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="grid size-24 place-items-center overflow-hidden rounded-pill" style={previewStyle}>
          <Character className="size-full" />
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-fg-secondary">{t("character")}</span>
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_CHARACTERS.map((id) => {
            const Option = AVATAR_CHARACTER_COMPONENTS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...value, character: id })}
                aria-pressed={value.character === id}
                aria-label={id}
                className={cn(
                  "grid size-10 place-items-center overflow-hidden rounded-pill border-2",
                  value.character === id ? "border-border-focus" : "border-transparent",
                )}
                style={previewStyle}
              >
                <Option className="size-full" />
              </button>
            );
          })}
        </div>
      </div>

      <SwatchRow<SkinColorId>
        label={t("skinColor")}
        ids={SKIN_COLORS}
        hexes={SKIN_COLOR_HEX}
        value={value.skinColor}
        onChange={(skinColor) => onChange({ ...value, skinColor })}
      />
      <SwatchRow<HairColorId>
        label={t("hairColor")}
        ids={HAIR_COLORS}
        hexes={HAIR_COLOR_HEX}
        value={value.hairColor}
        onChange={(hairColor) => onChange({ ...value, hairColor })}
      />
      <SwatchRow<ShirtColorId>
        label={t("shirtColor")}
        ids={SHIRT_COLORS}
        hexes={SHIRT_COLOR_HEX}
        value={value.shirtColor}
        onChange={(shirtColor) => onChange({ ...value, shirtColor })}
      />
      <SwatchRow<BackgroundColorId>
        label={t("backgroundColor")}
        ids={BACKGROUND_COLORS}
        hexes={BACKGROUND_COLOR_HEX}
        value={value.backgroundColor}
        onChange={(backgroundColor) => onChange({ ...value, backgroundColor })}
      />
    </div>
  );
}
