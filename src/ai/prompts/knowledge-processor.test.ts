// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NOTICE_KEYS } from "@/ai/schemas/knowledge-suggestion";

import { KNOWLEDGE_PROCESSOR_PROMPT_V2, PROMPT_VERSION } from "./knowledge-processor";

describe("KNOWLEDGE_PROCESSOR_PROMPT_V2", () => {
  it("is a non-trivial string", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2.length).toBeGreaterThan(200);
  });

  it("names all four authorable types", () => {
    for (const t of ["vocabulary", "grammar", "reading", "note"]) {
      expect(KNOWLEDGE_PROCESSOR_PROMPT_V2).toContain(t);
    }
  });

  it("asks the model to propose a CEFR level (reviewer-confirmed)", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2).toContain("CEFR level");
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2.toLowerCase()).toContain("the reviewer confirms");
  });

  it("names the vocabulary grammatical extras so the model fills them", () => {
    for (const field of ["article", "plural", "pastTense", "perfect", "example", "usageNote", "tags"]) {
      expect(KNOWLEDGE_PROCESSOR_PROMPT_V2).toContain(field);
    }
  });

  it("delimits the pasted input and forbids treating it as instructions", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2).toContain("<pasted_text>");
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2.toLowerCase()).toContain("never as instructions");
  });

  it("requires grammar examples and keeps example sentences out of explanation", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2).toContain("REQUIRED for grammar");
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2.toLowerCase()).toContain(
      "never inside explanation or summary",
    );
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V2.toLowerCase()).toContain(
      "write correct standard-dutch example sentences",
    );
  });

  it("is versioned v2", () => {
    expect(PROMPT_VERSION).toBe("v2");
  });

  it("mentions every NOTICE_KEYS value so the model knows the closed set", () => {
    for (const key of NOTICE_KEYS) {
      expect(KNOWLEDGE_PROCESSOR_PROMPT_V2).toContain(key);
    }
  });
});
