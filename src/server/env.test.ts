// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { serverEnv } from "./env";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.OPENAI_FALLBACK_MODEL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("serverEnv.aiApiKey", () => {
  it("is null when AI_API_KEY is unset", () => {
    expect(serverEnv.aiApiKey).toBeNull();
  });

  it("is null when AI_API_KEY is blank/whitespace", () => {
    process.env.AI_API_KEY = "   ";
    expect(serverEnv.aiApiKey).toBeNull();
  });

  it("returns the trimmed key when set", () => {
    process.env.AI_API_KEY = "  sk-ant-test  ";
    expect(serverEnv.aiApiKey).toBe("sk-ant-test");
  });
});

describe("serverEnv.aiModel", () => {
  it("defaults to gpt-5.6-luna", () => {
    expect(serverEnv.aiModel).toBe("gpt-5.6-luna");
  });

  it("uses AI_MODEL when set", () => {
    process.env.AI_MODEL = "gpt-5.6-pro";
    expect(serverEnv.aiModel).toBe("gpt-5.6-pro");
  });
});

describe("serverEnv.openaiFallbackModel", () => {
  it("defaults to gpt-5.6-terra", () => {
    expect(serverEnv.openaiFallbackModel).toBe("gpt-5.6-terra");
  });

  it("uses OPENAI_FALLBACK_MODEL when set", () => {
    process.env.OPENAI_FALLBACK_MODEL = "gpt-5.6-luna";
    expect(serverEnv.openaiFallbackModel).toBe("gpt-5.6-luna");
  });

  it("falls back to the default when blank/whitespace", () => {
    process.env.OPENAI_FALLBACK_MODEL = "   ";
    expect(serverEnv.openaiFallbackModel).toBe("gpt-5.6-terra");
  });
});
