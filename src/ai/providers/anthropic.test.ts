// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    messages = { parse };
    static APIError = APIError;
  }
  return { default: Anthropic, APIError };
});

import { AiProviderError } from "./types";
import { AnthropicProvider } from "./anthropic";

const schema = z.object({ type: z.literal("note"), body: z.string() });

function provider() {
  return new AnthropicProvider({ apiKey: "sk-ant-test", model: "claude-sonnet-5" });
}

beforeEach(() => {
  parse.mockReset();
});

describe("AnthropicProvider.generateStructured", () => {
  it("calls messages.parse with the model and an output_config format, returns parsed_output", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { type: "note", body: "hi" } });

    const out = await provider().generateStructured({ system: "S", user: "U", schema });

    expect(out).toEqual({ type: "note", body: "hi" });
    const arg = parse.mock.calls[0][0];
    expect(arg.model).toBe("claude-sonnet-5");
    expect(arg.system).toBe("S");
    expect(arg.messages).toEqual([{ role: "user", content: "U" }]);
    expect(arg.output_config?.format).toBeDefined();
  });

  it("throws AiProviderError when the model refuses", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    await expect(provider().generateStructured({ system: "S", user: "U", schema })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it("throws AiProviderError when parsed_output is null", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: null });
    await expect(provider().generateStructured({ system: "S", user: "U", schema })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it("wraps a thrown SDK error as AiProviderError", async () => {
    parse.mockRejectedValue(new Error("boom"));
    await expect(provider().generateStructured({ system: "S", user: "U", schema })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it("exposes a name", () => {
    expect(provider().name).toBe("anthropic");
  });
});
