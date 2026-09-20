"use client";

import { Ban, Dices } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, Button } from "@/components/ui";
import { randomAvatar } from "@/lib/avatar/generate";
import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import {
  BACKGROUND_COLORS,
  EARRINGS_VARIANTS,
  FACIAL_HAIR_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_COLORS,
  type AvatarConfig,
} from "@/types";

import { AvatarOptionGroup, type AvatarOption } from "./avatar-option-group";

type AccessoryKey = "glasses" | "earrings" | "facialHair";
const NONE = "none";

/** Sets an accessory, or removes the key entirely for "none" so the saved JSON
 * only ever contains accessories the user actually picked. */
function withAccessory<K extends AccessoryKey>(
  config: AvatarConfig,
  key: K,
  choice: NonNullable<AvatarConfig[K]> | typeof NONE,
): AvatarConfig {
  const next: AvatarConfig = { ...config };
  if (choice === NONE) delete next[key];
  else next[key] = choice as AvatarConfig[K];
  return next;
}

export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  const t = useTranslations("onboarding.avatar");

  /** A thumbnail is the current avatar with one field swapped, so what you see
   * on the tile is what you get. */
  const thumb = (patch: Partial<AvatarConfig>) => (
    <Avatar avatar={{ ...value, ...patch }} className="size-full" />
  );
  const noneTile = <Ban className="size-1/2 text-fg-muted" strokeWidth={1.75} aria-hidden />;

  const hairOptions: AvatarOption<AvatarConfig["hair"]>[] = HAIR_STYLES.map((hair) => ({
    id: hair,
    label: t(`hair.${hair}`),
    content: thumb({ hair }),
  }));

  const accessoryOptions = <K extends AccessoryKey>(
    key: K,
    variants: readonly NonNullable<AvatarConfig[K]>[],
  ): AvatarOption<NonNullable<AvatarConfig[K]> | typeof NONE>[] => [
    { id: NONE, label: t("none"), content: noneTile },
    ...variants.map((variant) => ({
      id: variant,
      label: t(`${key}.${variant}` as Parameters<typeof t>[0]),
      content: thumb({ [key]: variant }),
    })),
  ];

  const swatches = <Id extends string>(
    ids: readonly Id[],
    hex: Record<Id, string>,
  ): AvatarOption<Id>[] =>
    ids.map((id) => ({
      id,
      label: t(`colors.${id}` as Parameters<typeof t>[0]),
      color: hex[id],
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 flex items-center justify-center gap-4 bg-surface py-3 md:static md:flex-col md:py-0">
        <Avatar avatar={value} size="xl" aria-label={t("preview")} />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(randomAvatar())}>
          <Dices className="size-4" aria-hidden />
          {t("surpriseMe")}
        </Button>
      </div>

      <AvatarOptionGroup
        legend={t("groups.hair")}
        options={hairOptions}
        value={value.hair}
        onChange={(hair) => onChange({ ...value, hair })}
        variant="tile"
      />
      <AvatarOptionGroup
        legend={t("groups.hairColor")}
        options={swatches(HAIR_COLORS, HAIR_COLOR_HEX)}
        value={value.hairColor}
        onChange={(hairColor) => onChange({ ...value, hairColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.skinColor")}
        options={swatches(SKIN_COLORS, SKIN_COLOR_HEX)}
        value={value.skinColor}
        onChange={(skinColor) => onChange({ ...value, skinColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.shirtColor")}
        options={swatches(SHIRT_COLORS, SHIRT_COLOR_HEX)}
        value={value.shirtColor}
        onChange={(shirtColor) => onChange({ ...value, shirtColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.backgroundColor")}
        options={swatches(BACKGROUND_COLORS, BACKGROUND_COLOR_HEX)}
        value={value.backgroundColor}
        onChange={(backgroundColor) => onChange({ ...value, backgroundColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.glasses")}
        options={accessoryOptions("glasses", GLASSES_VARIANTS)}
        value={value.glasses ?? NONE}
        onChange={(choice) => onChange(withAccessory(value, "glasses", choice))}
        variant="tile"
      />
      <AvatarOptionGroup
        legend={t("groups.earrings")}
        options={accessoryOptions("earrings", EARRINGS_VARIANTS)}
        value={value.earrings ?? NONE}
        onChange={(choice) => onChange(withAccessory(value, "earrings", choice))}
        variant="tile"
      />
      <AvatarOptionGroup
        legend={t("groups.facialHair")}
        options={accessoryOptions("facialHair", FACIAL_HAIR_VARIANTS)}
        value={value.facialHair ?? NONE}
        onChange={(choice) => onChange(withAccessory(value, "facialHair", choice))}
        variant="tile"
      />

      <p className="text-caption text-fg-muted">
        {t("creditPrefix")}{" "}
        <a
          href="https://dribbble.com/micahlanier"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-fg-secondary"
        >
          Micah Lanier
        </a>
        {" · "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-fg-secondary"
        >
          CC BY 4.0
        </a>
        {" · "}
        <a
          href="https://www.dicebear.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-fg-secondary"
        >
          DiceBear
        </a>
      </p>
    </div>
  );
}
