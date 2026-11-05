import { embed, type JSONValue } from "ai";
import { z } from "zod";
import { embeddingModel, resolveEmbeddingRequest } from "./helpers/embeddingRequest.ts";
import { initCache, readAndProcessCache, writeCache } from "./helpers/cache.ts";
import formatDuration from "./helpers/formatDuration.ts";

/**
 * Generates a numerical embedding for text, useful for semantic search and clustering.
 *
 * Supports OpenAI, Gemini, Google Agent Platform and Ollama. Set
 * `AI_EMBEDDINGS_MODEL` and `AI_PROVIDER`; `AI_EMBEDDINGS_PROVIDER` can select a
 * different provider for embeddings. Cloud API keys use `AI_KEY`. Google Agent
 * Platform also accepts application credentials with `AI_PROJECT`/`AI_LOCATION`.
 * Ollama ignores `AI_KEY`. Anthropic does not provide native embeddings.
 *
 * Vectors are cached in `.journalism-cache` by default. Identity separates
 * providers, deployments, models, dimensions and model-specific settings.
 * `beforeRequest` runs only before uncached dispatches, including retries.
 * `maxRetries` defaults to zero. Cache entries from older identities are ignored.
 *
 * @example
 * ```ts
 * import { getEmbedding } from "@nshiab/journalism-ai";
 * // Configure AI_PROVIDER, AI_KEY and AI_EMBEDDINGS_MODEL first.
 * const vector = await getEmbedding("Local reporting matters.");
 * console.log(vector.length);
 * ```
 *
 * @example
 * ```ts
 * import { getEmbedding } from "@nshiab/journalism-ai";
 * const vector = await getEmbedding("Local reporting matters.", {
 *   provider: "ollama", model: "nomic-embed-text", contextWindow: 8192,
 *   beforeRequest: async () => {
 *     await new Promise((resolve) => setTimeout(resolve, 100));
 *   },
 * });
 * console.log(vector);
 * ```
 *
 * @param text - The text to embed.
 * @param options - Provider, model, cache and request settings. `dimensions` is
 * available for supporting cloud models; `contextWindow` is Ollama-only.
 * `providerOptions` forwards non-secret AI SDK settings such as Google's task type.
 * @returns A non-empty vector of finite numbers.
 * @category AI
 */
export default async function getEmbedding(
  text: string,
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
): Promise<number[]> {
  const start = Date.now();
  options.abortSignal?.throwIfAborted();
  const resolved = resolveEmbeddingRequest(options);
  const maxRetries = options.maxRetries ?? 0;
  if (!Number.isInteger(maxRetries) || maxRetries < 0)
    throw new Error("maxRetries must be a non-negative integer.");
  const vectorSchema =
    resolved.dimensions === undefined
      ? z.array(z.number().finite()).nonempty()
      : z.array(z.number().finite()).length(resolved.dimensions);
  const files =
    (options.cache ?? true)
      ? initCache({ identity: resolved.identity, text }, "getEmbedding-v3")
      : null;
  if (files) {
    const cached = await readAndProcessCache(files.cacheFile, (value) =>
      z.object({ response: vectorSchema }).parse(value),
    );
    if (cached !== null) return cached.response;
  }
  const model = await embeddingModel(resolved, options.fetch);
  const guardedModel: typeof model = {
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    modelId: model.modelId,
    maxEmbeddingsPerCall: model.maxEmbeddingsPerCall,
    supportsParallelCalls: model.supportsParallelCalls,
    async doEmbed(request) {
      request.abortSignal?.throwIfAborted();
      await options.beforeRequest?.();
      request.abortSignal?.throwIfAborted();
      return model.doEmbed(request);
    },
  };
  const result = await embed({
    model: guardedModel,
    value: text,
    dimensions: resolved.dimensions,
    providerOptions: resolved.providerOptions,
    maxRetries,
    abortSignal: options.abortSignal,
  });
  options.abortSignal?.throwIfAborted();
  const vector = vectorSchema.parse(result.embedding);
  if (files) writeCache(files.cacheFile, { response: vector });
  if (options.verbose)
    console.log(
      `[getEmbedding] ${resolved.provider}/${resolved.model}: ${formatDuration(Date.now() - start)}`,
    );
  return vector;
}
