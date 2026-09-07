import "server-only";

import OpenAI from "openai";
import { makeParseableTextFormat } from "openai/lib/parser";
import { z } from "zod";

import { type AiProvider, AiProviderError } from "./types";

/**
 * OpenAI's strict Structured Outputs — and the `zodTextFormat` helper that wraps
 * them — require an object at the schema root and reject any `.optional()` field
 * that is not also `.nullable()`. Our `knowledgeSuggestionSchema` is a
 * discriminated union whose members carry several bare `.optional()` fields, so
 * `zodTextFormat(schema, …)` throws on it outright (verified against
 * `openai@7`). To keep `generateStructured` generic and the union intact we:
 *
 *   1. wrap the caller's schema in `{ result: <schema> }` so the JSON Schema root
 *      is an object;
 *   2. emit a lenient (`strict: false`) JSON Schema with Zod itself — no
 *      all-fields-required / nullable rewrite; and
 *   3. re-validate the model's JSON against the caller's real Zod schema before
 *      it reaches `response.output_parsed`, returning `null` on a mismatch.
 *
 * The trade-off vs. `zodTextFormat`: we lean on Zod validation plus the
 * primary → fallback model retry instead of the API's strict-decoding guarantee.
 */
function buildTextFormat<T>(schema: z.ZodType<T>, name: string) {
  const wrapped = z.object({ result: schema });
  const jsonSchema = z.toJSONSchema(wrapped, {
    target: "draft-7",
    io: "output",
    unrepresentable: "any",
  }) as Record<string, unknown>;

  return makeParseableTextFormat<T | null>(
    { type: "json_schema", name, strict: false, schema: jsonSchema },
    (content) => {
      const result = wrapped.safeParse(JSON.parse(content));
      return result.success ? (result.data.result as T) : null;
    },
  );
}

/** Best-effort: pull a model refusal string out of the raw response output. */
function extractRefusal(response: unknown): string | null {
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        (part as { type?: unknown }).type === "refusal" &&
        typeof (part as { refusal?: unknown }).refusal === "string"
      ) {
        return (part as { refusal: string }).refusal;
      }
    }
  }
  return null;
}

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly fallbackModel: string;

  constructor({
    apiKey,
    model,
    fallbackModel,
  }: {
    apiKey: string;
    model: string;
    fallbackModel: string;
  }) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.fallbackModel = fallbackModel;
  }

  async generateStructured<T>({
    system,
    user,
    schema,
  }: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
  }): Promise<T> {
    const attempt = async (modelId: string): Promise<T> => {
      let response;
      try {
        response = await this.client.responses.parse({
          model: modelId,
          instructions: system,
          input: user,
          reasoning: { effort: "medium" },
          max_output_tokens: 16000,
          text: { format: buildTextFormat(schema, "knowledge_suggestion") },
        });
      } catch (cause) {
        const detail = cause instanceof OpenAI.APIError ? `: ${cause.message}` : "";
        throw new AiProviderError(`OpenAI request failed on "${modelId}"${detail}`, { cause });
      }

      if (response.status === "incomplete") {
        throw new AiProviderError(
          `OpenAI response on "${modelId}" was incomplete (${response.incomplete_details?.reason ?? "unknown"})`,
        );
      }
      if (response.output_parsed == null) {
        const refusal = extractRefusal(response);
        throw new AiProviderError(
          `OpenAI on "${modelId}" returned no schema-valid output${refusal ? `: ${refusal}` : ""}`,
        );
      }
      return response.output_parsed as T;
    };

    try {
      return await attempt(this.model);
    } catch (primaryErr) {
      if (!this.fallbackModel || this.fallbackModel === this.model) throw primaryErr;
      console.warn(
        `[ai:openai] "${this.model}" failed (${(primaryErr as Error).message}); retrying with "${this.fallbackModel}"`,
      );
      try {
        return await attempt(this.fallbackModel);
      } catch (fallbackErr) {
        throw new AiProviderError(
          `OpenAI failed on both "${this.model}" and "${this.fallbackModel}"`,
          { cause: fallbackErr },
        );
      }
    }
  }
}
