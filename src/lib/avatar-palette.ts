import type {
  BackgroundColorId,
  HairColorId,
  ShirtColorId,
  SkinColorId,
} from "@/types";

export const SKIN_COLOR_HEX: Record<SkinColorId, string> = {
  porcelain: "#F7DCC6",
  ivory: "#F0C8A0",
  tan: "#D9A066",
  almond: "#B97B4E",
  brown: "#8A5A3B",
  deep: "#5C3A24",
};

export const HAIR_COLOR_HEX: Record<HairColorId, string> = {
  black: "#2B2118",
  "dark-brown": "#4A3222",
  brown: "#6B4423",
  chestnut: "#8B5A2B",
  blonde: "#D8B26A",
  ginger: "#B5542B",
  gray: "#A9A9A9",
  pink: "#E39BC4",
};

export const SHIRT_COLOR_HEX: Record<ShirtColorId, string> = {
  teal: "#2F9E8F",
  coral: "#E8674A",
  sunflower: "#F2B705",
  sky: "#3E92CC",
  grape: "#7C5CBF",
  mint: "#4FB477",
  slate: "#55637A",
  rose: "#D65D8A",
};

export const BACKGROUND_COLOR_HEX: Record<BackgroundColorId, string> = {
  cream: "#F5EFE6",
  blush: "#F6DDE0",
  mint: "#DFF3EA",
  sky: "#DCEBFA",
  lilac: "#E7DFF6",
  sand: "#EFE3D0",
};
