"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-h2 text-fg">{t("title")}</h1>
        <p className="text-body text-fg-muted">{t("body")}</p>
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </div>
  );
}
