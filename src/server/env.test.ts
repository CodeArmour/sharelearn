// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { serverEnv } from "./env";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
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
  it("defaults to claude-sonnet-5", () => {
    expect(serverEnv.aiModel).toBe("claude-sonnet-5");
  });

  it("uses AI_MODEL when set", () => {
    process.env.AI_MODEL = "claude-opus-5";
    expect(serverEnv.aiModel).toBe("claude-opus-5");
  });
});
