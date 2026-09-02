import { Inter, Lora, Poppins } from "next/font/google";

/**
 * Typography families from the approved Figma design.
 *
 * - Poppins  — display, headings, titles, knowledge terms (static weights 500 / 600)
 * - Inter    — body copy, UI, controls (variable weight, normal + italic)
 * - Lora     — long-form reading passages (variable weight, normal + italic)
 *
 * Each exposes a CSS variable consumed by `@theme` in `globals.css`
 * (`--font-sans`, `--font-display`, `--font-reading`). Self-hosted by next/font,
 * so no runtime request to Google.
 */

export const fontInter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-inter-src",
  display: "swap",
});

export const fontPoppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-poppins-src",
  display: "swap",
});

export const fontLora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-lora-src",
  display: "swap",
});

/** Space-separated `variable` class names for the root `<html>` element. */
export const fontVariables = `${fontInter.variable} ${fontPoppins.variable} ${fontLora.variable}`;
