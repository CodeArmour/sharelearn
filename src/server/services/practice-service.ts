import "server-only";

import { listKnowledgeItems } from "@/server/repositories/knowledge";
import { NotFoundError } from "@/server/errors";
import { resolveActiveContext } from "@/server/services/session-service";
import { composeExam, type ExamPools } from "./exam-composition";
import type {
  GrammarItem,
  KnowledgeItem,
  PracticeQuestion,
  PracticeSetup,
  ReadingItem,
  VocabularyItem,
} from "@/types";

async function requireActiveGroupId(): Promise<string> {
  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") throw new NotFoundError("No active group");
  return ctx.activeGroup.id;
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildOptions(correct: string, pool: string[], seed: string) {
  const distractors = [...new Set(pool)]
    .filter((v) => v && v !== correct)
    .sort((a, b) => a.localeCompare(b, "nl"))
    .slice(0, 3);
  const all = [correct, ...distractors];
  const rot = hashString(seed) % all.length;
  const options = [...all.slice(rot), ...all.slice(0, rot)];
  return { options, correctIndex: options.indexOf(correct) };
}

function isSameCalendarDay(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

function buildVocabQuestions(
  items: VocabularyItem[],
  allTerms: string[],
  allMeanings: string[],
): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((v, idx) => {
    if (idx % 2 === 1) {
      const { options, correctIndex } = buildOptions(v.term, allTerms, `t:${v.id}`);
      if (options.length >= 2) {
        out.push({
          id: `q_${v.id}_t`,
          knowledgeId: v.id,
          knowledgeType: "vocabulary",
          instructionKey: "sayInDutch",
          prompt: v.meaning,
          options,
          correctIndex,
        });
      }
    } else {
      const { options, correctIndex } = buildOptions(v.meaning, allMeanings, `m:${v.id}`);
      if (options.length >= 2) {
        out.push({
          id: `q_${v.id}_m`,
          knowledgeId: v.id,
          knowledgeType: "vocabulary",
          instructionKey: "meaningOf",
          prompt: v.term,
          options,
          correctIndex,
        });
      }
    }
  });
  return out;
}

function buildGrammarQuestions(items: GrammarItem[], allTitles: string[]): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((g) => {
    const { options, correctIndex } = buildOptions(g.title, allTitles, `g:${g.id}`);
    if (options.length >= 2) {
      out.push({
        id: `q_${g.id}`,
        knowledgeId: g.id,
        knowledgeType: "grammar",
        instructionKey: "whichRule",
        prompt: g.examples[0]?.nl ?? g.summary,
        options,
        correctIndex,
      });
    }
  });
  return out;
}

function buildReadingQuestions(items: ReadingItem[]): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((r) => {
    const quiz = r.readingQuiz;
    if (!quiz) return;
    for (const qq of quiz.questions) {
      out.push({
        id: `q_${r.id}_${qq.id}`,
        knowledgeId: r.id,
        knowledgeType: "reading",
        instructionKey: qq.kind === "true-false" ? "trueOrFalse" : "readComprehension",
        prompt: qq.prompt,
        options: qq.options,
        correctIndex: qq.correctIndex,
        passage: { id: r.id, title: r.title, body: r.body },
      });
    }
  });
  return out;
}

export async function generatePracticeQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]> {
  const groupId = await requireActiveGroupId();
  // Every pool below is derived from this one call — never query a second
  // group, and never let a second group's items enter the distractor pools.
  const groupItems: KnowledgeItem[] = await listKnowledgeItems(groupId, {});
  const now = new Date();

  const inScope = groupItems.filter((item) => {
    if (setup.scope === "today") return isSameCalendarDay(item.createdAt, now);
    if (setup.scope === "level") return item.level === setup.level;
    if (setup.scope === "review") return (setup.reviewIds ?? []).includes(item.id);
    if (setup.scope === "custom") {
      const f = setup.filter ?? {};
      if (f.type && item.type !== f.type) return false;
      if (f.level && item.level !== f.level) return false;
      if (f.by && item.addedBy.id !== f.by) return false;
      if (f.q) {
        // Search only the human-authored fields — never the AI-generated quiz,
        // whose invented distractors would silently widen `custom`-scope matches.
        const searchable = item.type === "reading" ? { ...item, readingQuiz: undefined } : item;
        if (!JSON.stringify(searchable).toLowerCase().includes(f.q.toLowerCase())) return false;
      }
      return true;
    }
    return true;
  });

  const vocabPool = groupItems.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const grammarPool = groupItems.filter((i): i is GrammarItem => i.type === "grammar");
  const allMeanings = vocabPool.map((v) => v.meaning);
  const allTerms = vocabPool.map((v) => v.term);
  const allTitles = grammarPool.map((g) => g.title);

  const wantVocab = setup.mode === "vocabulary" || setup.mode === "mixed";
  const wantGrammar = setup.mode === "grammar" || setup.mode === "mixed";
  const wantReading = setup.mode === "reading" || setup.mode === "mixed";

  const inScopeVocab = inScope.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const inScopeGrammar = inScope.filter((i): i is GrammarItem => i.type === "grammar");
  const inScopeReading = inScope.filter((i): i is ReadingItem => i.type === "reading");

  const questions: PracticeQuestion[] = [
    ...(wantVocab ? buildVocabQuestions(inScopeVocab, allTerms, allMeanings) : []),
    ...(wantGrammar ? buildGrammarQuestions(inScopeGrammar, allTitles) : []),
    ...(wantReading ? buildReadingQuestions(inScopeReading) : []),
  ];

  const sortKey = (q: PracticeQuestion) =>
    q.passage ? hashString(q.passage.id) : hashString(q.id);
  questions.sort((a, b) => sortKey(a) - sortKey(b));
  return setup.length > 0 ? questions.slice(0, setup.length) : questions;
}

export async function generateExamQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]> {
  const groupId = await requireActiveGroupId();
  const groupItems: KnowledgeItem[] = await listKnowledgeItems(groupId, {});
  if (!setup.level) return [];

  const levelItems = groupItems.filter((i) => i.level === setup.level);
  const vocabAll = groupItems.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const allTerms = vocabAll.map((v) => v.term);
  const allMeanings = vocabAll.map((v) => v.meaning);
  const allTitles = groupItems
    .filter((i): i is GrammarItem => i.type === "grammar")
    .map((g) => g.title);

  const sortKey = (q: PracticeQuestion) =>
    q.passage ? hashString(q.passage.id) : hashString(q.id);
  const ordered = (list: PracticeQuestion[]) => [...list].sort((a, b) => sortKey(a) - sortKey(b));

  const pools: ExamPools = {
    reading: ordered(
      buildReadingQuestions(levelItems.filter((i): i is ReadingItem => i.type === "reading")),
    ),
    grammar: ordered(
      buildGrammarQuestions(
        levelItems.filter((i): i is GrammarItem => i.type === "grammar"),
        allTitles,
      ),
    ),
    vocabulary: ordered(
      buildVocabQuestions(
        levelItems.filter((i): i is VocabularyItem => i.type === "vocabulary"),
        allTerms,
        allMeanings,
      ),
    ),
  };

  return composeExam(pools, setup.length).sort((a, b) => sortKey(a) - sortKey(b));
}
