import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import ollama from "ollama";
import crypto from "node:crypto";
import { prettyDuration } from "@nshiab/journalism-format";
import {
  type GetEmbeddingOptions,
  resolveEmbeddingRequest,
} from "./embeddingOptions.ts";

/**
 * Generates a numerical embedding (vector representation) for a given text string. Embeddings are crucial for various natural language processing (NLP) tasks, including semantic search, text classification, clustering, and anomaly detection, as they allow text to be processed and compared mathematically.
 *
 * This function supports both Google's Gemini AI models and local models running with Ollama. It provides options for authentication, model selection, and caching to optimize performance and cost.
 *
 * **Authentication**:
 * With no explicit provider, credentials, model information, and provider selection come from environment variables (`AI_KEY`, `AI_PROJECT`, `AI_LOCATION`, `AI_EMBEDDINGS_MODEL`, `AI_EMBEDDINGS_PROVIDER`). Providerless options intentionally contain only fields shared by every provider.
 *
 * **Local Models**:
 * To use a local model with Ollama, pass `provider: "ollama"`, or set `AI_EMBEDDINGS_PROVIDER=ollama` (the legacy `OLLAMA` environment variable is also supported), and ensure Ollama is running. A custom `Ollama` client can be passed in the provider-specific `ollama` option.
 *
 * **Caching**:
 * Responses are cached by default in a local `.journalism-cache` directory. If the same request is made again, the cached response will be returned, avoiding redundant API calls. Set `cache` to `false` to disable caching. Remember to add `.journalism-cache` to your `.gitignore` file.
 *
 * @param text The input text string for which to generate the embedding.
 * @param options Configuration options for the embedding generation.
 * @param options.provider Explicitly selects Gemini/Vertex or Ollama. When omitted, `AI_EMBEDDINGS_PROVIDER` is used, then the legacy `OLLAMA` fallback, then Gemini.
 * @param options.model The specific embedding model to use (e.g., 'text-embedding-004'). Defaults to the `AI_EMBEDDINGS_MODEL` environment variable.
 * @param options.apiKey Your Gemini API or Vertex Express Mode API key. Defaults to the `AI_KEY` environment variable.
 * @param options.vertex If `true`, explicitly selects the Vertex AI backend for the Google provider.
 * @param options.project Your Google Cloud project ID for Vertex AI. Defaults to the `AI_PROJECT` environment variable.
 * @param options.location The Google Cloud location for your Vertex AI project. Defaults to the `AI_LOCATION` environment variable.
 * @param options.cache If `true`, enables caching of the embedding response. Defaults to `true`.
 * @param options.ollama A custom Ollama client. Boolean selection remains supported at runtime for compatibility but is deprecated; use `provider: "ollama"` instead.
 * @param options.verbose If `true`, logs additional information such as execution time and the truncated input text. Defaults to `false`.
 *   @param options.contextWindow - An option to specify the context window size for Ollama models. By default, Ollama sets this depending on the model, which can be lower than the actual maximum context window size of the model.
 *
 * @returns A promise that resolves to an array of numbers representing the generated embedding.
 *
 * @example
 * ```ts
 * // Environment-selected usage. Configure AI_EMBEDDINGS_PROVIDER,
 * // AI_EMBEDDINGS_MODEL, and the matching credentials first.
 * const embedding = await getEmbedding("The quick brown fox jumps over the lazy dog.");
 * console.log(embedding); // [0.012, -0.034, ..., 0.056] (example output)
 * ```
 * @example
 * ```ts
 * // Embeddings are cached by default.
 * const cachedEmbedding = await getEmbedding("Artificial intelligence is transforming industries.");
 * console.log(cachedEmbedding);
 * ```
 * @example
 * ```ts
 * // Generate an embedding using a specific model and API key.
 * const customEmbedding = await getEmbedding("Machine learning is a subset of AI.", {
 *   provider: "gemini",
 *   model: "another-embedding-model",
 *   apiKey: "your_custom_api_key"
 * });
 * console.log(customEmbedding);
 * ```
 * @example
 * ```ts
 * // Explicit Vertex AI usage.
 * const vertexEmbedding = await getEmbedding("Local reporting matters.", {
 *   provider: "gemini",
 *   vertex: true,
 *   model: "text-embedding-004",
 *   project: "your-project",
 *   location: "northamerica-northeast1",
 * });
 * ```
 * @example
 * ```ts
 * // Explicit Ollama usage.
 * const ollamaEmbedding = await getEmbedding("Local reporting matters.", {
 *   provider: "ollama",
 *   model: "nomic-embed-text",
 *   contextWindow: 8192,
 * });
 * ```
 * @example
 * ```ts
 * // Generate an embedding with verbose logging.
 * const verboseEmbedding = await getEmbedding("The quick brown fox jumps over the lazy dog.", { verbose: true });
 * console.log(verboseEmbedding);
 * ```
 * @category AI
 */
export default async function getEmbedding(
  text: string,
  options: GetEmbeddingOptions = {},
): Promise<number[]> {
  const start = Date.now();
  const resolved = resolveEmbeddingRequest(options);
  const { identity } = resolved;
  const model = identity.model;
  const cache = options.cache ?? true;

  if (options.verbose) {
    console.log(`\nText for ${model}:`);
    console.log(text.length > 50 ? `${text.slice(0, 50)}...` : text);
  }

  const cacheKeyInput = { identity, text };

  let cacheFileJSON;
  if (cache) {
    const cachePath = "./.journalism-cache";
    if (!existsSync(cachePath)) {
      mkdirSync(cachePath);
    }
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(cacheKeyInput))
      .digest("hex");
    cacheFileJSON =
      `${cachePath}/getEmbedding-v${identity.schemaVersion}-${hash}.json`;
    if (existsSync(cacheFileJSON)) {
      const cachedResponse = JSON.parse(readFileSync(cacheFileJSON, "utf-8"));
      if (options.verbose) {
        console.log("\nReturning cached JSON response.");
      }
      return cachedResponse;
    } else {
      if (options.verbose) {
        console.log("\nCache missed. Generating new response...");
      }
    }
  }

  let rawResponse: unknown;
  if (identity.backend === "ollama") {
    const client = resolved.ollama ?? ollama;
    const response = await client.embed({
      model,
      input: text,
      options: {
        num_ctx: identity.contextWindow,
      },
    });
    rawResponse = response.embeddings;
  } else {
    if (
      identity.backend === "gemini-api" && !resolved.apiKey
    ) {
      throw new Error(
        'No Gemini API key found. Set AI_KEY or pass apiKey with provider: "gemini".',
      );
    }
    if (
      identity.backend === "vertex" && !resolved.apiKey &&
      !(resolved.project && resolved.location)
    ) {
      throw new Error(
        "No Vertex credentials found. Set AI_PROJECT and AI_LOCATION, or pass an API key for Vertex Express Mode.",
      );
    }
    const client = new GoogleGenAI({
      apiKey: resolved.apiKey,
      vertexai: identity.backend === "vertex",
      project: resolved.project,
      location: resolved.location,
    });
    const response = await client.models.embedContent({
      model,
      contents: text,
    });
    rawResponse = response.embeddings;
  }

  if (!Array.isArray(rawResponse) || rawResponse.length === 0) {
    throw new Error(
      "Invalid response from the API. Please check your model and input.",
    );
  }
  const firstEmbedding = rawResponse[0];
  const returnedResponse = Array.isArray(firstEmbedding)
    ? firstEmbedding
    : typeof firstEmbedding === "object" && firstEmbedding !== null &&
        "values" in firstEmbedding && Array.isArray(firstEmbedding.values)
    ? firstEmbedding.values
    : undefined;
  if (
    !Array.isArray(returnedResponse) || typeof returnedResponse[0] !== "number"
  ) {
    throw new Error(
      "Invalid response from the API. Please check your model and input.",
    );
  }

  if (cache && cacheFileJSON) {
    if (returnedResponse && Array.isArray(returnedResponse)) {
      writeFileSync(cacheFileJSON, JSON.stringify(returnedResponse));
      if (options.verbose) {
        console.log("Response cached as JSON.");
      }
    }
  }

  if (options.verbose) {
    console.log("Execution time:", prettyDuration(start));
  }

  return returnedResponse;
}
