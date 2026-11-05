import type { JSONValue } from "ai";
import { resolveEmbeddingRequest } from "./helpers/embeddingRequest.ts";

/**
 * Returns the non-secret identity that determines embedding compatibility.
 *
 * Uses the same provider, deployment, model and semantic settings as
 * `getEmbedding`. Credentials, cache controls, logging and callbacks are excluded.
 * Compare this identity before reusing persisted vectors; changing models or
 * dimensions requires re-embedding the data. Older identity versions are incompatible.
 *
 * @example
 * ```ts
 * import { getEmbeddingIdentity } from "@nshiab/journalism-ai";
 * const identity = getEmbeddingIdentity({
 *   provider: "ollama", model: "nomic-embed-text", contextWindow: 8192,
 * });
 * console.log(identity);
 * ```
 *
 * @param options - The same configuration used for the embedding request.
 * @param environment - Environment defaults; uses `process.env` when omitted.
 * @returns The canonical identity used for embedding caches and persisted data.
 * @category AI
 */
export default function getEmbeddingIdentity(
  options: {
    provider?: "openai" | "gemini" | "google-agent-platform" | "ollama";
    model?: string;
    apiKey?: string;
    project?: string;
    location?: string;
    baseURL?: string;
    dimensions?: number;
    contextWindow?: number;
    providerOptions?: { [provider: string]: { [key: string]: JSONValue } };
    cache?: boolean;
    verbose?: boolean;
    beforeRequest?: () => void | Promise<void>;
    maxRetries?: number;
    abortSignal?: AbortSignal;
    fetch?: typeof globalThis.fetch;
  } = {},
  environment: Record<string, string | undefined> = process.env,
): {
  schemaVersion: 3;
  provider: "openai" | "gemini" | "google-agent-platform" | "ollama";
  model: string;
  endpoint: string;
  authentication: "api-key" | "adc" | "none";
  project?: string;
  location?: string;
  dimensions?: number;
  contextWindow?: number;
  providerOptions: { [provider: string]: { [key: string]: JSONValue } };
} {
  return resolveEmbeddingRequest(options, environment).identity;
}
