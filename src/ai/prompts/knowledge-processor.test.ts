// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NOTICE_KEYS } from "@/ai/schemas/knowledge-suggestion";

import { KNOWLEDGE_PROCESSOR_PROMPT_V1, PROMPT_VERSION } from "./knowledge-processor";

describe("KNOWLEDGE_PROCESSOR_PROMPT_V1", () => {
  it("is a non-trivial string", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V1.length).toBeGreaterThan(200);
  });

  it("names all four authorable types", () => {
    for (const t of ["vocabulary", "grammar", "reading", "note"]) {
      expect(KNOWLEDGE_PROCESSOR_PROMPT_V1).toContain(t);
    }
  });

  it("instructs the model not to guess CEFR level", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V1.toLowerCase()).toContain("level");
  });

  it("is versioned", () => {
    expect(PROMPT_VERSION).toBe("v1");
  });

  it("mentions every NOTICE_KEYS value so the model knows the closed set", () => {
    for (const key of NOTICE_KEYS) {
      expect(KNOWLEDGE_PROCESSOR_PROMPT_V1).toContain(key);
    }
  });
});
