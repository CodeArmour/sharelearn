import type { z } from "zod";

/** Raised for any provider-side failure: transport error, refusal, or output
 *  that could not be parsed into the requested schema. Never let a raw SDK
 *  error escape a provider. */
export class AiProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  readonly name: string;
  /** Ask the model for a single structured object matching `schema`. Resolves
   *  with the parsed, schema-valid value or throws `AiProviderError`. */
  generateStructured<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    /** Signed image URLs — sent as `input_image` parts when present. */
    images?: { url: string }[];
  }): Promise<T>;
}
