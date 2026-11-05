import type askAI from "./askAI.ts";
import { generateResponse } from "./helpers/generateResponse.ts";
import type { JSONValue, LanguageModel } from "ai";
import { resolveProvider } from "./helpers/provider.ts";
import sleep from "./helpers/sleep.ts";

/**
 * Processes AI requests concurrently with one pool for every provider.
 *
 * Uses the same environment configuration, files, caching and response processing
 * as `askAI`. Results and terminal errors retain each request's index and optional
 * ID, and are returned in input order.
 *
 * `retry` is the number of additional attempts (default zero). It covers provider
 * and response-processing failures; transport retries are disabled inside the
 * pool. `retryCheck` can restrict retries. `minRequestDurationMs` sets a minimum
 * duration for each worker attempt, including failures. Cache hits skip the
 * request's `beforeRequest` hook. Configuration is captured before workers start.
 *
 * @example
 * ```ts
 * import { askAIPool } from "@nshiab/journalism-ai";
 * // Configure AI_PROVIDER, AI_MODEL and the matching credentials first.
 * const { results, errors } = await askAIPool([
 *   { id: "france", prompt: "What is the capital of France?" },
 *   { id: "germany", prompt: "What is the capital of Germany?" },
 * ], 5, { retry: 2 });
 * for (const entry of results) console.log(entry.request.id, entry.result.response);
 * console.log(`${errors.length} failed`);
 * ```
 *
 * @example
 * ```ts
 * import { askAIPool } from "@nshiab/journalism-ai";
 * import { z } from "zod";
 * const { results } = await askAIPool([
 *   { prompt: "List three European countries.", options: {
 *     schemaJson: z.toJSONSchema(z.array(z.string())),
 *     processResponse: (value) => z.array(z.string()).parse(value),
 *   } },
 * ], 2, { minRequestDurationMs: 1000 });
 * console.log(results[0]?.result.response.join(", "));
 * ```
 *
 * @param requests - Prompts with optional IDs and `askAI` options.
 * @param poolSize - Maximum concurrent requests; a positive integer.
 * @param options - Progress logging, retries and per-worker pacing.
 * @returns Successful responses and terminal errors, each sorted by original index.
 * @category AI
 */
export default function askAIPool<TResponse = unknown>(
  requests: {
    id?: string;
    prompt: string;
    options?: {
      model?:
        | string
        | {
            readonly specificationVersion: "v4";
            readonly provider: string;
            readonly modelId: string;
            supportedUrls: PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;
            /** Generates one model response. */
            doGenerate: Extract<LanguageModel, { specificationVersion: "v4" }>["doGenerate"];
            /** The model adapter's streaming method. */
            doStream: Extract<LanguageModel, { specificationVersion: "v4" }>["doStream"];
          };
      apiKey?: string;
      project?: string;
      location?: string;
      baseURL?: string;
      cacheKey?: string;
      systemPrompt?: string;
      schemaJson?: unknown;
      /** Validates or transforms every response, including cache hits. */
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
      /** Awaits pacing immediately before each uncached adapter call. */
      beforeRequest?: () => void | Promise<void>;
      abortSignal?: AbortSignal;
      /** Custom transport for a built-in provider. */
      fetch?: typeof globalThis.fetch;
    };
  }[],
  poolSize: number,
  options?: {
    logProgress?: boolean;
    retry?: number;
    retryCheck?: (error: unknown) => boolean | Promise<boolean>;
    minRequestDurationMs?: number;
  },
): Promise<{
  results: {
    index: number;
    request: Parameters<typeof askAIPool<TResponse>>[0][number];
    result: Awaited<ReturnType<typeof askAI<TResponse>>>;
  }[];
  errors: {
    index: number;
    request: Parameters<typeof askAIPool<TResponse>>[0][number];
    error: unknown;
  }[];
}>;
export default async function askAIPool(
  requests: Requests,
  poolSize: number,
  options: PoolOptions = {},
): Promise<PoolResult> {
  if (!Number.isInteger(poolSize) || poolSize < 1)
    throw new Error("poolSize must be a positive integer.");
  const retries = options.retry ?? 0;
  if (!Number.isInteger(retries) || retries < 0)
    throw new Error("retry must be a non-negative integer.");
  const minimum = options.minRequestDurationMs ?? 0;
  if (!Number.isFinite(minimum) || minimum < 0)
    throw new Error("minRequestDurationMs must be a finite non-negative number.");
  const queue = requests.map((request, index) => ({
    request: { ...request },
    index,
    attempt: 0,
    captured: captureOptions(request.options),
  }));
  const results: PoolResult["results"] = [];
  const errors: PoolResult["errors"] = [];
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const start = Date.now();
      try {
        const result = await generateResponse(
          item.request.prompt,
          { ...item.captured.settings, maxRetries: 0 },
          item.captured.provider,
          item.captured.environment,
        );
        results.push({ index: item.index, request: item.request, result });
        if (options.logProgress) console.log(`[askAIPool] Request ${item.index} processed`);
      } catch (error) {
        if (item.attempt < retries && (!options.retryCheck || (await options.retryCheck(error)))) {
          queue.push({ ...item, attempt: item.attempt + 1 });
          if (options.logProgress)
            console.log(
              `[askAIPool] Request ${item.index} retrying (${item.attempt + 1}/${retries})`,
            );
        } else {
          errors.push({ index: item.index, request: item.request, error });
          if (options.logProgress) console.log(`[askAIPool] Request ${item.index} failed`);
        }
      }
      if (minimum) await sleep(minimum, start);
    }
  };
  await Promise.all(Array.from({ length: Math.min(poolSize, requests.length) }, worker));
  return {
    results: results.sort((a, b) => a.index - b.index),
    errors: errors.sort((a, b) => a.index - b.index),
  };
}

type Requests = Parameters<typeof askAIPool>[0];
type PoolOptions = NonNullable<Parameters<typeof askAIPool>[2]>;
type PoolResult = Awaited<ReturnType<typeof askAIPool>>;

/** Snapshots configuration without cloning clients, callbacks or abort signals. */
function captureOptions(options: Requests[number]["options"] = {}): {
  settings: NonNullable<Requests[number]["options"]>;
  provider: string;
  environment: Record<string, string | undefined>;
} {
  const environment = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    AI_KEY: process.env.AI_KEY,
    AI_PROJECT: process.env.AI_PROJECT,
    AI_LOCATION: process.env.AI_LOCATION,
    OLLAMA_HOST: process.env.OLLAMA_HOST,
  };
  const selected = environment.AI_PROVIDER;
  if (!selected?.trim()) throw new Error("Set AI_PROVIDER before calling askAIPool.");
  const provider = typeof options.model === "object" ? selected : resolveProvider(selected);
  const settings = {
    ...options,
    files: options.files?.map((file) => ({ ...file })),
    schemaJson: structuredClone(options.schemaJson),
    providerOptions: structuredClone(options.providerOptions),
  };
  return { settings, provider, environment };
}
