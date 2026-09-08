import { Suspense } from "react";

import { isAiConfigured } from "@/ai/providers/config";
import { titleMetadata } from "@/lib/page-metadata";
import { resolveActiveContext } from "@/server/services/session-service";
import { AddKnowledgeView } from "@/features/add";

export const generateMetadata = titleMetadata((t) => t("nav.add"));

export default async function AddKnowledgePage() {
  // `resolveActiveContext` is memoized per request via React `cache()` and the
  // (app) layout already calls it — this adds no extra round trip. The id is
  // the Storage prefix the photo capture flow uploads under.
  const ctx = await resolveActiveContext();
  const userId = ctx.status === "ok" ? ctx.user.id : undefined;
  return (
    <Suspense>
      <AddKnowledgeView aiEnabled={isAiConfigured()} userId={userId} />
    </Suspense>
  );
}
