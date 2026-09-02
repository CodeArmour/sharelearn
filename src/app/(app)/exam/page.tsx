import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Examen" };

export default function ExamPage() {
  return (
    <PlaceholderPage
      title="Examen"
      description="Genereer een examen, lever het in en bekijk je resultaten en fouten."
    />
  );
}
