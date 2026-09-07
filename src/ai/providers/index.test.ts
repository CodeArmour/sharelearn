// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({ serverEnv: { aiApiKey: null as string | null, aiModel: "claude-sonnet-5" } }));

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
    vi.mocked(serverEnv).aiApiKey = "sk-ant-test";
    const p = getAiProvider();
    expect(p).not.toBeNull();
    expect(p?.name).toBe("anthropic");
    expect(isAiConfigured()).toBe(true);
  });
});
