import { titleMetadata } from "@/lib/page-metadata";
import { AddKnowledgeView } from "@/features/add";

export const generateMetadata = titleMetadata((t) => t("nav.add"));

export default function AddKnowledgePage() {
  return <AddKnowledgeView />;
}
