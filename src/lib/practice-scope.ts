import { getTranslations } from "next-intl/server";

import type { GroupMemberSummary, KnowledgeType, PracticeFilter } from "@/types";
import { KNOWLEDGE_TYPES } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

/**
 * Read a Library filter (`q` / `type` / `level` / `by`) out of the Practice or
 * Exam page's search params. Returns `undefined` when none are set.
 */
export function parsePracticeFilter(sp: SearchParams): PracticeFilter | undefined {
  const type = one(sp.type);
  const filter: PracticeFilter = {
    q: one(sp.q),
    type: (KNOWLEDGE_TYPES as readonly string[]).includes(type ?? "")
      ? (type as KnowledgeType)
      : undefined,
    level: one(sp.level),
    by: one(sp.by),
  };
  return filter.q || filter.type || filter.level || filter.by ? filter : undefined;
}

/** "A2 · Vocabulary · added by Sofie · matching “terras”" */
export async function buildFilterSummary(
  filter: PracticeFilter,
  members: GroupMemberSummary[],
): Promise<string> {
  const [tType, tKnowledge, tSetup] = await Promise.all([
    getTranslations("knowledge.type"),
    getTranslations("knowledge"),
    getTranslations("practice.setup"),
  ]);

  const parts: string[] = [];
  if (filter.level) parts.push(filter.level);
  if (filter.type) parts.push(tType(filter.type));
  if (filter.by) {
    const member = members.find((m) => m.id === filter.by);
    if (member) parts.push(tKnowledge("addedBy", { name: member.name }));
  }
  if (filter.q) parts.push(tSetup("filterMatching", { q: filter.q }));
  return parts.join(" · ");
}
