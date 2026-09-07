// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn();

vi.mock("openai", () => {
  class APIError extends Error {}
  class OpenAI {
    responses = { parse };
    static APIError = APIError;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
  }
  return { default: OpenAI };
});

import { AiProviderError } from "./types";
import { OpenAIProvider } from "./openai";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("note"), body: z.string().min(1), title: z.string().optional() }),
  z.object({ type: z.literal("vocabulary"), term: z.string().min(1), meaning: z.string().min(1) }),
]);

const PRIMARY = "gpt-5.6-luna";
const FALLBACK = "gpt-5.6-terra";

function provider({ model = PRIMARY, fallbackModel = FALLBACK } = {}) {
  return new OpenAIProvider({ apiKey: "sk-openai-test", model, fallbackModel });
}

/** A completed response whose parsed value is `body`. */
function ok(body: unknown) {
  return { status: "completed", output: [], output_parsed: body };
}

beforeEach(() => {
  parse.mockReset();
});

describe("OpenAIProvider.generateStructured", () => {
  it("calls responses.parse with the primary model + a json_schema text format, returns output_parsed", async () => {
    parse.mockResolvedValueOnce(ok({ type: "note", body: "hi" }));

    const out = await provider().generateStructured({ system: "S", user: "U", schema });

    expect(out).toEqual({ type: "note", body: "hi" });
    expect(parse).toHaveBeenCalledTimes(1);
    const arg = parse.mock.calls[0][0];
    expect(arg.model).toBe(PRIMARY);
    expect(arg.instructions).toBe("S");
    expect(arg.input).toBe("U");
    expect(arg.text?.format).toBeDefined();
    expect(arg.text.format.type).toBe("json_schema");
  });

  it("retries on the fallback model when the primary parse call throws", async () => {
    parse.mockRejectedValueOnce(new Error("network boom"));
    parse.mockResolvedValueOnce(ok({ type: "vocabulary", term: "huis", meaning: "house" }));

    const out = await provider().generateStructured({ system: "S", user: "U", schema });

    expect(out).toEqual({ type: "vocabulary", term: "huis", meaning: "house" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[0][0].model).toBe(PRIMARY);
    expect(parse.mock.calls[1][0].model).toBe(FALLBACK);
  });

  it("retries on the fallback model when the primary returns no parsed output (refusal / mismatch)", async () => {
    parse.mockResolvedValueOnce({ status: "completed", output: [], output_parsed: null });
    parse.mockResolvedValueOnce(ok({ type: "note", body: "recovered" }));

    const out = await provider().generateStructured({ system: "S", user: "U", schema });

    expect(out).toEqual({ type: "note", body: "recovered" });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("retries on the fallback model when the primary response is incomplete", async () => {
    parse.mockResolvedValueOnce({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [],
      output_parsed: null,
    });
    parse.mockResolvedValueOnce(ok({ type: "note", body: "recovered" }));

    const out = await provider().generateStructured({ system: "S", user: "U", schema });

    expect(out).toEqual({ type: "note", body: "recovered" });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("rejects with AiProviderError when both the primary and the fallback fail", async () => {
    parse.mockRejectedValueOnce(new Error("primary down"));
    parse.mockRejectedValueOnce(new Error("fallback down"));

    await expect(
      provider().generateStructured({ system: "S", user: "U", schema }),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the fallback model equals the primary model", async () => {
    parse.mockRejectedValueOnce(new Error("only attempt"));

    await expect(
      provider({ model: PRIMARY, fallbackModel: PRIMARY }).generateStructured({
        system: "S",
        user: "U",
        schema,
      }),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("exposes a name", () => {
    expect(provider().name).toBe("openai");
  });
});
