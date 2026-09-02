import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Oefenen" };

export default function PracticePage() {
  return (
    <PlaceholderPage
      title="Oefenen"
      description="Gestructureerd oefenen met opgeslagen kennis: vragen, feedback en resultaten."
    />
  );
}
