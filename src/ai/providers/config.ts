import "server-only";

import { serverEnv } from "@/server/env";

/** Cheap check for callers (e.g. a Server Component) that only need to know
 *  whether the AI path is configured. SDK-free — safe outside the server. */
export function isAiConfigured(): boolean {
  return serverEnv.aiApiKey != null;
}
