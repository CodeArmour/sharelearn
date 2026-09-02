import type { Metadata } from "next";

import { getTodayFeed } from "@/data/mock";
import { formatDutchDateLong } from "@/lib/utils/date";
import { TodayView } from "@/features/today";

export const metadata: Metadata = { title: "Vandaag" };

export default async function TodayPage() {
  const feed = await getTodayFeed();
  const subtitle = `${formatDutchDateLong(feed.date)} · wat de groep vandaag heeft geleerd`;

  return <TodayView feed={feed} subtitle={subtitle} />;
}
