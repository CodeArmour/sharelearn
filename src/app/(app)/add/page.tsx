import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Toevoegen" };

export default function AddKnowledgePage() {
  return (
    <PlaceholderPage
      title="Kennis toevoegen"
      description="Woordenschat, grammatica, teksten of bestanden vastleggen — later met AI-hulp om alles te structureren."
    />
  );
}
