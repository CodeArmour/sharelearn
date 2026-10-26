import "server-only";

import { listKnowledgeItems } from "@/server/repositories/knowledge";
import { NotFoundError } from "@/server/errors";
import { resolveActiveContext } from "@/server/services/session-service";
import { composeExam, randomizeQuestionBlocks, type ExamPools } from "./exam-composition";
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

function blankTermInExample(example: string | null, term: string): string | null {
  if (!example) return null;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedTerm})(?=$|[^\\p{L}\\p{N}])`, "iu");
  if (!matcher.test(example)) return null;
  return example.replace(matcher, "$1___");
}

function vocabularyFallbackSentence(item: VocabularyItem): string {
  const partOfSpeech = item.partOfSpeech.toLowerCase();
  if (partOfSpeech.includes("verb") || partOfSpeech.includes("werkwoord")) return "Wij willen ___.";
  if (partOfSpeech.includes("noun") || partOfSpeech.includes("zelfstandig naamwoord")) return "Ik zie ___.";
  if (partOfSpeech.includes("adjective") || partOfSpeech.includes("bijvoeglijk")) return "Dat is ___.";
  return "Ik gebruik ___ vaak.";
}

/** Build sentence-completion questions for vocabulary practice and exams. */
function buildVocabularyClozeQuestions(items: VocabularyItem[], allTerms: string[]): PracticeQuestion[] {
  return items.flatMap((item) => {
    const { options, correctIndex } = buildOptions(item.term, allTerms, `fill:${item.id}`);
    if (options.length < 2) return [];

    return [{
      id: `q_${item.id}_fill`,
      knowledgeId: item.id,
      knowledgeType: "vocabulary" as const,
      instructionKey: "fillBlank" as const,
      prompt: blankTermInExample(item.example, item.term) ?? vocabularyFallbackSentence(item),
      options,
      correctIndex,
    }];
  });
}

function buildGrammarQuestions(items: GrammarItem[]): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((g) => {
    const quiz = g.grammarQuiz;
    if (!quiz) return; // not generated / AI disabled → contributes nothing
    for (const qq of quiz.questions) {
      out.push({
        id: `q_${g.id}_${qq.id}`,
        knowledgeId: g.id,
        knowledgeType: "grammar",
        instructionKey: qq.kind === "true-false" ? "trueOrFalse" : "fillBlank",
        prompt: qq.prompt,
        options: qq.options,
        correctIndex: qq.correctIndex,
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
        // Search only the human-authored fields — never an AI-generated quiz,
        // whose invented distractors would silently widen `custom`-scope matches.
        const searchable =
          item.type === "reading"
            ? { ...item, readingQuiz: undefined }
            : item.type === "grammar"
              ? { ...item, grammarQuiz: undefined }
              : item;
        if (!JSON.stringify(searchable).toLowerCase().includes(f.q.toLowerCase())) return false;
      }
      return true;
    }
    return true;
  });

  const vocabPool = groupItems.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const allTerms = vocabPool.map((v) => v.term);

  const wantVocab = setup.mode === "vocabulary" || setup.mode === "mixed";
  const wantGrammar = setup.mode === "grammar" || setup.mode === "mixed";
  const wantReading = setup.mode === "reading" || setup.mode === "mixed";

  const inScopeVocab = inScope.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const inScopeGrammar = inScope.filter((i): i is GrammarItem => i.type === "grammar");
  const inScopeReading = inScope.filter((i): i is ReadingItem => i.type === "reading");

  const questions: PracticeQuestion[] = [
    ...(wantVocab ? buildVocabularyClozeQuestions(inScopeVocab, allTerms) : []),
    ...(wantGrammar ? buildGrammarQuestions(inScopeGrammar) : []),
    ...(wantReading ? buildReadingQuestions(inScopeReading) : []),
  ];

  const randomized = randomizeQuestionBlocks(questions);
  return setup.length > 0 ? randomized.slice(0, setup.length) : randomized;
}

export async function generateExamQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]> {
  const groupId = await requireActiveGroupId();
  const groupItems: KnowledgeItem[] = await listKnowledgeItems(groupId, {});
  if (!setup.level) return [];

  const levelItems = groupItems.filter((i) => i.level === setup.level);
  const vocabAll = groupItems.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const allTerms = vocabAll.map((v) => v.term);

  const pools: ExamPools = {
    reading: buildReadingQuestions(
      levelItems.filter((i): i is ReadingItem => i.type === "reading"),
    ),
    grammar: buildGrammarQuestions(
      levelItems.filter((i): i is GrammarItem => i.type === "grammar"),
    ),
    vocabulary: buildVocabularyClozeQuestions(
      levelItems.filter((i): i is VocabularyItem => i.type === "vocabulary"),
      allTerms,
    ),
  };

  return composeExam(pools, setup.length);
}
