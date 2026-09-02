import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Profiel" };

export default function ProfilePage() {
  return (
    <PlaceholderPage
      title="Profiel"
      description="Je persoonlijke instellingen, voortgang en kennis die je voor herhaling hebt gemarkeerd."
    />
  );
}
