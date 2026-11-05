import type { JSONValue, LanguageModel } from "ai";
import { generateResponse } from "./helpers/generateResponse.ts";

/**
 * Asks an AI model for text or validated structured data.
 *
 * Set `AI_PROVIDER`, `AI_MODEL` and `AI_KEY`. Providers are `openai`,
 * `anthropic`, `gemini`, `google-agent-platform` and `ollama`. Ollama ignores
 * `AI_KEY`; Google Agent Platform also supports application credentials with
 * `AI_PROJECT` and optional `AI_LOCATION` (default `global`). Explicit model and credential options
 * override their environment values. Provider selection is never inferred from keys.
 *
 * Original responses are cached in `.journalism-cache` by default. Add that
 * directory to `.gitignore`, or set `cache: false`. `processResponse` runs on
 * every call, including cache hits, and its output is never cached.
 *
 * Pass a JSON Schema through `schemaJson` for locally validated output. Arrays
 * and primitives are supported through an internal object envelope. Failed,
 * refused or incomplete responses are not cached. Local file contents are part
 * of cache identity; version mutable GCS objects with `cacheKey` or disable cache.
 *
 * Images/text work with supported models; cloud models also accept PDFs.
 * Audio/video require Google; `gs://` URLs require Google Agent Platform.
 * Sampling is left to the model. `maxRetries` defaults to zero; each uncached
 * dispatch awaits `beforeRequest`. Model-specific settings use `providerOptions`.
 * Known Gemini API costs are estimated; other model costs are `null`.
 *
 * @example
 * ```ts
 * import { askAI } from "@nshiab/journalism-ai";
 * // Set AI_PROVIDER=openai, AI_KEY and AI_MODEL first.
 * const result = await askAI("What is the capital of France?");
 * console.log(result.response);
 * ```
 *
 * @example
 * ```ts
 * import { askAI } from "@nshiab/journalism-ai";
 * import { z } from "zod";
 * const result = await askAI("List three countries.", {
 *   schemaJson: z.toJSONSchema(z.array(z.string())),
 *   processResponse: (value) => z.array(z.string()).parse(value),
 * });
 * console.log(result.response.join(", "));
 * ```
 *
 * @example
 * ```ts
 * import { askAI } from "@nshiab/journalism-ai";
 * const result = await askAI("Describe this image.", {
 *   files: [{ path: "photo.png", type: "image" }],
 * });
 * console.log(result.response);
 * ```
 *
 * @param prompt - The primary text prompt.
 * @param options - Model, files, caching and response processing. A custom AI SDK
 * v4 model adapter can be passed as `model`; configure its credentials directly
 * and provide a non-secret deployment/configuration `cacheKey`, or disable cache.
 * @returns The response with provider, cache, usage, reasoning, timing, warnings
 * and web-search sources. Output-token counts include reasoning tokens.
 * @category AI
 */
export default function askAI<TResponse = unknown>(
  prompt: string,
  options?: {
    model?:
      | string
      | {
          readonly specificationVersion: "v4";
          readonly provider: string;
          readonly modelId: string;
          supportedUrls: PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;
          doGenerate: Extract<LanguageModel, { specificationVersion: "v4" }>["doGenerate"];
          doStream: Extract<LanguageModel, { specificationVersion: "v4" }>["doStream"];
        };
    apiKey?: string;
    project?: string;
    location?: string;
    baseURL?: string;
    cacheKey?: string;
    systemPrompt?: string;
    schemaJson?: unknown;
    processResponse?: (response: unknown) => TResponse | Promise<TResponse>;
    files?: {
      path: string;
      type: "text" | "image" | "pdf" | "audio" | "video";
      mediaType?: string;
    }[];
    cache?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
    reasoning?:
      | "provider-default"
      | "none"
      | "minimal"
      | "low"
      | "medium"
      | "high"
      | "xhigh"
      | "max";
    webSearch?: boolean;
    providerOptions?: { [provider: string]: { [key: string]: JSONValue } };
    maxRetries?: number;
    beforeRequest?: () => void | Promise<void>;
    abortSignal?: AbortSignal;
    fetch?: typeof globalThis.fetch;
  },
): Promise<{
  response: TResponse;
  fromCache: boolean;
  provider: string;
  model: string;
  prompt: string;
  systemPrompt: string | null;
  promptTokenCount: number;
  outputTokenCount: number;
  thoughtsTokenCount: number;
  totalTokens: number;
  tokensPerSecond: number | null;
  durationMs: number;
  thoughts: string | null;
  estimatedCost: number | null;
  finishReason: string;
  sources: { url: string; title?: string }[];
  warnings: { type: string; message: string }[];
}>;
export default async function askAI(
  prompt: string,
  options: NonNullable<Parameters<typeof askAI>[1]> = {},
): Promise<Awaited<ReturnType<typeof askAI>>> {
  return generateResponse(prompt, options);
}
