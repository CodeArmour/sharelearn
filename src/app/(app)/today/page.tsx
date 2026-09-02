import { getLocale, getTranslations } from "next-intl/server";

import { getTodayFeed } from "@/data/mock";
import { formatDateLong } from "@/lib/utils/date";
import { titleMetadata } from "@/lib/page-metadata";
import { TodayView } from "@/features/today";

export const generateMetadata = titleMetadata((t) => t("nav.today"));

export default async function TodayPage() {
  const [feed, t, locale] = await Promise.all([
    getTodayFeed(),
    getTranslations("today"),
    getLocale(),
  ]);
  const subtitle = t("subtitle", { date: formatDateLong(feed.date, locale) });

  return <TodayView feed={feed} subtitle={subtitle} />;
}
