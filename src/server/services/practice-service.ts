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

function sampleRandom<T>(items: T[], count: number): T[] {
  const sampled = [...items];
  for (let index = sampled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [sampled[index], sampled[swapIndex]] = [sampled[swapIndex], sampled[index]];
  }
  return sampled.slice(0, count);
}

function buildOptions(correct: string, pool: string[]) {
  const distractors = sampleRandom(
    [...new Set(pool)].filter((value) => value && value !== correct),
    3,
  );
  return { options: [correct, ...distractors], correctIndex: 0 };
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

function hasClozeContext(prompt: string): boolean {
  return prompt.replace("___", "").replace(/[^\p{L}\p{N}]/gu, "").length > 0;
}

function vocabularyQuestionPrompt(
  item: VocabularyItem,
): Pick<PracticeQuestion, "instructionKey" | "prompt"> {
  const cloze = blankTermInExample(item.example, item.term);
  if (cloze && hasClozeContext(cloze)) return { instructionKey: "fillBlank", prompt: cloze };
  if (cloze) return { instructionKey: "sayInDutch", prompt: item.meaning };
  return { instructionKey: "fillBlank", prompt: vocabularyFallbackSentence(item) };
}

/** Build contextual vocabulary questions for practice and exams. */
function buildVocabularyQuestions(items: VocabularyItem[], allTerms: string[]): PracticeQuestion[] {
  return items.flatMap((item) => {
    const { options, correctIndex } = buildOptions(item.term, allTerms);
    if (options.length < 2) return [];

    const questionPrompt = vocabularyQuestionPrompt(item);
    return [{
      id: `q_${item.id}_fill`,
      knowledgeId: item.id,
      knowledgeType: "vocabulary" as const,
      ...questionPrompt,
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
    ...(wantVocab ? buildVocabularyQuestions(inScopeVocab, allTerms) : []),
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
    vocabulary: buildVocabularyQuestions(
      levelItems.filter((i): i is VocabularyItem => i.type === "vocabulary"),
      allTerms,
    ),
  };

  return composeExam(pools, setup.length);
}
