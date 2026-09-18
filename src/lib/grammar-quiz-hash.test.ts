import { describe, expect, it } from "vitest";

import { grammarSourceHash } from "./grammar-quiz-hash";

const base = {
  title: "Woordvolgorde",
  summary: "Werkwoord op de tweede plaats.",
  explanation: "In een hoofdzin staat het werkwoord altijd op de tweede plaats.",
  examples: [{ nl: "Ik werk vandaag.", en: "I work today." }],
};

describe("grammarSourceHash", () => {
  it("is stable for identical content", () => {
    expect(grammarSourceHash(base)).toBe(grammarSourceHash({ ...base }));
  });

  it("ignores whitespace and case differences", () => {
    const cosmetic = {
      ...base,
      explanation: "  IN EEN   hoofdzin staat het werkwoord altijd op de tweede plaats.  ",
    };
    expect(grammarSourceHash(cosmetic)).toBe(grammarSourceHash(base));
  });

  it("changes when the title changes", () => {
    expect(grammarSourceHash({ ...base, title: "Andere titel" })).not.toBe(grammarSourceHash(base));
  });

  it("changes when the explanation changes", () => {
    expect(grammarSourceHash({ ...base, explanation: "Iets anders." })).not.toBe(
      grammarSourceHash(base),
    );
  });

  it("changes when an example sentence changes", () => {
    const changed = { ...base, examples: [{ nl: "Ik werk morgen.", en: "I work tomorrow." }] };
    expect(grammarSourceHash(changed)).not.toBe(grammarSourceHash(base));
  });

  it("changes when the number of examples changes", () => {
    const changed = { ...base, examples: [...base.examples, { nl: "Zij werkt niet.", en: null }] };
    expect(grammarSourceHash(changed)).not.toBe(grammarSourceHash(base));
  });
});
