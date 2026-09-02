import Link from "next/link";
import { Camera, FileText, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const focusRing =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/**
 * CaptureBar — the always-present "add knowledge" entry point on Today.
 * Maps to the Figma `capture-bar` (desktop) / `capture` (mobile). The prompt
 * area, the photo/file shortcuts and the submit button are separate links so
 * each can later carry its own `source` intent; for now they all open /add.
 */
export async function CaptureBar() {
  const t = await getTranslations("today.capture");

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface py-3 pr-3 pl-3.5 sm:gap-3 sm:py-3.5 sm:pr-3.5 sm:pl-[18px]">
      <Link
        href="/add"
        className={cn("flex min-w-0 flex-1 items-center gap-2.5 text-fg-muted sm:gap-3", focusRing)}
      >
        <Plus className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="truncate text-body-sm sm:text-body">
          <span className="sm:hidden">{t("placeholderShort")}</span>
          <span className="hidden sm:inline">{t("placeholder")}</span>
        </span>
        <span className="sr-only">{t("openLabel")}</span>
      </Link>

      <Link
        href="/add"
        aria-label={t("photoLabel")}
        className={cn("shrink-0 p-1 text-fg-secondary hover:text-fg", focusRing)}
      >
        <Camera className="size-5" strokeWidth={1.75} aria-hidden />
      </Link>

      <Link
        href="/add"
        aria-label={t("fileLabel")}
        className={cn("hidden shrink-0 p-1 text-fg-secondary hover:text-fg sm:block", focusRing)}
      >
        <FileText className="size-5" strokeWidth={1.75} aria-hidden />
      </Link>

      <Link
        href="/add"
        className={cn(buttonVariants({ size: "sm" }), "hidden shrink-0 sm:inline-flex")}
      >
        {t("submit")}
      </Link>
    </div>
  );
}
