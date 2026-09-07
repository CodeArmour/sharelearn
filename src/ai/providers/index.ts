import { serverEnv } from "@/server/env";

import { AnthropicProvider } from "./anthropic";
import type { AiProvider } from "./types";

export type { AiProvider } from "./types";
export { AiProviderError } from "./types";

/** The configured provider, or `null` when no `AI_API_KEY` is set. */
export function getAiProvider(): AiProvider | null {
  const apiKey = serverEnv.aiApiKey;
  if (!apiKey) return null;
  return new AnthropicProvider({ apiKey, model: serverEnv.aiModel });
}

/** Cheap check for callers that only need to know whether the AI path is on
 *  (e.g. a Server Component deciding whether to render the capture box).
 *  Does not construct a client or import the SDK. */
export function isAiConfigured(): boolean {
  return serverEnv.aiApiKey != null;
}
