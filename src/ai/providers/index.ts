import "server-only";

import { serverEnv } from "@/server/env";

import { OpenAIProvider } from "./openai";
import type { AiProvider } from "./types";

export type { AiProvider } from "./types";
export { AiProviderError } from "./types";
export { isAiConfigured } from "./config";

/** The configured provider, or `null` when no `AI_API_KEY` is set. */
export function getAiProvider(): AiProvider | null {
  if (serverEnv.aiApiKey == null) return null;
  return new OpenAIProvider({
    apiKey: serverEnv.aiApiKey,
    model: serverEnv.aiModel,
    fallbackModel: serverEnv.openaiFallbackModel,
  });
}
