// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  serverEnv: {
    aiApiKey: null as string | null,
    aiModel: "gpt-5.6-luna",
    openaiFallbackModel: "gpt-5.6-terra",
  },
}));

import { serverEnv } from "@/server/env";
import { getAiProvider, isAiConfigured } from "./index";

afterEach(() => {
  vi.mocked(serverEnv).aiApiKey = null;
});

describe("getAiProvider / isAiConfigured", () => {
  it("returns null / false when no key is configured", () => {
    expect(getAiProvider()).toBeNull();
    expect(isAiConfigured()).toBe(false);
  });

  it("returns a provider / true when a key is configured", () => {
    vi.mocked(serverEnv).aiApiKey = "sk-openai-test";
    const p = getAiProvider();
    expect(p).not.toBeNull();
    expect(p?.name).toBe("openai");
    expect(isAiConfigured()).toBe(true);
  });
});
