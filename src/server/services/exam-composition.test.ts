// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PracticeQuestion } from "@/types";

import { composeExam, randomizeQuestionBlocks, type ExamPools } from "./exam-composition";

function pool(type: PracticeQuestion["knowledgeType"], n: number): PracticeQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${type}_${i}`,
    knowledgeId: `k_${type}_${i}`,
    knowledgeType: type,
    instructionKey: "meaningOf",
    prompt: `${type} ${i}`,
    options: ["a", "b"],
    correctIndex: 0,
  }));
}

const byType = (qs: PracticeQuestion[]) => ({
  reading: qs.filter((q) => q.knowledgeType === "reading").length,
  grammar: qs.filter((q) => q.knowledgeType === "grammar").length,
  vocabulary: qs.filter((q) => q.knowledgeType === "vocabulary").length,
});

describe("composeExam", () => {
  it("splits 10 as 4 reading / 3 grammar / 3 vocab", () => {
    const pools: ExamPools = {
      reading: pool("reading", 20),
      grammar: pool("grammar", 20),
      vocabulary: pool("vocabulary", 20),
    };
    const out = composeExam(pools, 10);
    expect(out).toHaveLength(10);
    expect(byType(out)).toEqual({ reading: 4, grammar: 3, vocabulary: 3 });
  });

  it("splits 20 as 7 / 7 / 6", () => {
    const pools: ExamPools = {
      reading: pool("reading", 20),
      grammar: pool("grammar", 20),
      vocabulary: pool("vocabulary", 20),
    };
    expect(byType(composeExam(pools, 20))).toEqual({ reading: 7, grammar: 7, vocabulary: 6 });
  });

  it("uses the random source to choose and arrange questions", () => {
    const pools: ExamPools = {
      reading: pool("reading", 20),
      grammar: pool("grammar", 20),
      vocabulary: pool("vocabulary", 20),
    };
    const first = composeExam(pools, 10, () => 0.999999);
    const second = composeExam(pools, 10, () => 0);
    expect(second.map((question) => question.id)).not.toEqual(first.map((question) => question.id));
  });

  it("randomizes every question's choices while preserving its correct answer", () => {
    const [question] = randomizeQuestionBlocks([
      {
        id: "q1",
        knowledgeId: "k1",
        knowledgeType: "vocabulary",
        instructionKey: "fillBlank",
        prompt: "Ik ___ vandaag.",
        options: ["werk", "werkt", "werken", "gewerkt"],
        correctIndex: 0,
      },
    ], () => 0);

    expect(question.options).toEqual(["werkt", "werken", "gewerkt", "werk"]);
    expect(question.correctIndex).toBe(3);
  });

 it("redistributes an empty pool's share to the others, keeping the total", () => {
    const pools: ExamPools = {
      reading: pool("reading", 10),
      grammar: [],
      vocabulary: pool("vocabulary", 10),
    };
    const out = composeExam(pools, 10);
    expect(out).toHaveLength(10);
    const t = byType(out);
    expect(t.grammar).toBe(0);
    expect(t.reading + t.vocabulary).toBe(10);
  });

  it("runs short when the pools together can't fill the length", () => {
    const pools: ExamPools = {
      reading: pool("reading", 2),
      grammar: pool("grammar", 2),
      vocabulary: pool("vocabulary", 2),
    };
    expect(composeExam(pools, 20)).toHaveLength(6);
  });

  it("'all' (length 0) is 3 x the smallest pool", () => {
    const pools: ExamPools = {
      reading: pool("reading", 4),
      grammar: pool("grammar", 9),
      vocabulary: pool("vocabulary", 12),
    };
    const out = composeExam(pools, 0);
    expect(out).toHaveLength(12);
    expect(byType(out)).toEqual({ reading: 4, grammar: 4, vocabulary: 4 });
  });

  it("'all' with an empty pool yields nothing", () => {
    const pools: ExamPools = {
      reading: [],
      grammar: pool("grammar", 5),
      vocabulary: pool("vocabulary", 5),
    };
    expect(composeExam(pools, 0)).toEqual([]);
  });
});
