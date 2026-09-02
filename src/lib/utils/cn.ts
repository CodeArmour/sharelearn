import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, taught about this project's custom `@theme` scales so it can
 * tell a custom font-size (`text-body`, `text-caption`) apart from a custom text
 * colour (`text-fg-muted`, `text-info-strong`) — otherwise it collapses both
 * into one group and drops the colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "h2",
            "h3",
            "title",
            "term",
            "quiz",
            "body-lg",
            "body",
            "body-sm",
            "label",
            "caption",
            "button",
            "reading",
          ],
        },
      ],
      rounded: [{ rounded: ["card", "modal", "pill"] }],
      shadow: [{ shadow: ["card", "elevated", "modal"] }],
    },
  },
});

/**
 * Merge conditional class names and resolve Tailwind conflicts
 * (last utility of a group wins). Use everywhere class names are composed.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
