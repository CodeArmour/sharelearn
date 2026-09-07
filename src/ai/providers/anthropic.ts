import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import { type AiProvider, AiProviderError } from "./types";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor({ apiKey, model }: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
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
    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: zodOutputFormat(schema) },
      });
    } catch (cause) {
      throw new AiProviderError(
        cause instanceof Anthropic.APIError
          ? `Anthropic request failed: ${cause.message}`
          : "Anthropic request failed",
        { cause },
      );
    }

    if (response.stop_reason === "refusal") {
      throw new AiProviderError("Anthropic declined to structure this input");
    }
    if (response.parsed_output == null) {
      throw new AiProviderError("Anthropic returned output that did not match the schema");
    }
    return response.parsed_output as T;
  }
}
