import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getGroupMembers } from "@/data/mock";

export const metadata: Metadata = { title: "Groep" };

export default async function GroupSettingsPage() {
  const members = await getGroupMembers();
  return (
    <PlaceholderPage
      title="Groep"
      description={`${members.length} leden delen deze leeromgeving.`}
      note="Groepsinstellingen (leden, uitnodigingen, rollen) volgen later."
    />
  );
}
