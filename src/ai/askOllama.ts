import { readFileSync } from "node:fs";
import process from "node:process";
import ollama, { Ollama } from "ollama";
import { fromJSONSchema } from "zod";
import { initCache, readAndProcessCache, writeCache } from "./helpers/cache.ts";
import { processResponse } from "./helpers/processResponse.ts";

function validateStructuredResponse(
  response: unknown,
  schemaJson: unknown,
): unknown {
  if (schemaJson === undefined) {
    return response;
  }
  const schema = fromJSONSchema(
    schemaJson as Parameters<typeof fromJSONSchema>[0],
  );
  return schema.parse(response);
}

/** The detailed response shape returned by {@link askOllama}. */
export type OllamaDetailedResponse<TResponse = unknown> = {
  response: TResponse;
  fromCache: boolean;
  prompt: string;
  systemPrompt: string | null;
  thinkingLevel: boolean | "low" | "medium" | "high" | null;
  contextWindow: number | null;
  temperature: number;
  files: { path: string; type: "image" | "text" }[];
  promptTokenCount: number;
  outputTokenCount: number;
  totalTokens: number;
  tokensPerSecond: number;
  durationMs: number;
  model: string;
  thoughts: string | null;
};

/** Configuration accepted by {@link askOllama}. */
export type AskOllamaOptions<TResponse = unknown> = {
  systemPrompt?: string;
  model?: string;
  ollama?: unknown;
  files?: { path: string; type: "image" | "text" }[];
  schemaJson?: unknown;
  cache?: boolean;
  contextWindow?: number;
  thinkingLevel?: boolean | "low" | "medium" | "high";
  temperature?: number;
  ollamaParameters?: unknown;
  processResponse?: (response: unknown) => TResponse | Promise<TResponse>;
};

/**
 * Interacts with a local Ollama model to perform a wide range of tasks.
 *
 * Ollama must be running on the machine. Set the `AI_MODEL` environment
 * variable or pass `model` directly.
 *
 * Pass a custom `Ollama` instance via the `ollama` option to target a
 * non-default host.
 *
 * **File handling**: pass local files via `files: [{ path, type }]`. Only `"image"`
 * and `"text"` types are supported for now.
 *
 * **Caching**: responses are persisted in `.journalism-cache` by default. Set
 * `cache: false` to disable caching.
 *
 * Temperature defaults to 0 for deterministic responses.
 *
 * @example
 * ```ts
 * // Assumes AI_MODEL is set in environment variables.
 * const result = await askOllama("What is the capital of France?");
 * console.log(result.response); // "Paris"
 * ```
 *
 * @example
 * ```ts
 * // Use a custom Ollama instance.
 * import { Ollama } from "ollama";
 * const client = new Ollama({ host: "http://127.0.0.1:11434" });
 * const result = await askOllama("What is the capital of France?", { ollama: client });
 * ```
 *
 * @example
 * ```ts
 * // Analyse a local image.
 * const result = await askOllama("Describe this image.", {
 *   files: [{ path: "./photo.jpg", type: "image" }],
 * });
 * ```
 *
 * @example
 * ```ts
 * // Structured JSON output.
 * import * as z from "zod";
 * const schema = z.toJSONSchema(z.object({ country: z.string(), capital: z.string() }));
 * const result = await askOllama(
 *   "What is the capital of France?",
 *   { schemaJson: schema },
 * );
 * ```
 *
 * @example
 * ```ts
 * // Enable thinking / reasoning.
 * const result = await askOllama(
 *   "What is 17 * 23?",
 *   { thinkingLevel: "low" },
 * );
 * ```
 *
 * @example
 * ```ts
 * // Access token usage directly from the response.
 * const result = await askOllama("What is the capital of France?");
 * console.log(result.response); // "Paris"
 * console.log(`${result.totalTokens} tokens in ${result.durationMs}ms`);
 * ```
 *
 * @param prompt - The primary text prompt.
 * @param options.model - Model name; defaults to `AI_MODEL` env var.
 * @param options.ollama - Custom `Ollama` instance targeting a specific host.
 * @param options.systemPrompt - Optional system prompt.
 * @param options.files - Files to send alongside the prompt. Only `"image"` and `"text"` types are supported (local paths only; no GCS, audio, video, or PDF). Text files are sent as separate user messages after the prompt; images are sent as attachments to the prompt message.
 * @param options.schemaJson - JSON schema for structured output.
 * @param options.cache - Cache the response in `.journalism-cache`. Defaults to `true`.
 * @param options.contextWindow - Override the model's context window size.
 * @param options.thinkingLevel - Enables reasoning. Pass `true` for models that only support on/off, or `"low"`, `"medium"`, or `"high"` for granular control.
 * @param options.temperature - Sampling temperature (default 0).
 * @param options.ollamaParameters - Extra params merged into `client.chat`.
 * @param options.processResponse - Transform or validate the response before it is returned. If it rejects a cached response, that cache entry is removed so a retry can generate a fresh response.
 *
 * @category AI
 */
export default async function askOllama<TResponse = unknown>(
  prompt: string,
  options: AskOllamaOptions<TResponse> = {},
): Promise<OllamaDetailedResponse<TResponse>> {
  const start = Date.now();

  const detailedData: OllamaDetailedResponse = {
    response: undefined,
    prompt: prompt,
    systemPrompt: options.systemPrompt ?? null,
    thinkingLevel: options.thinkingLevel ?? null,
    contextWindow: options.contextWindow ?? null,
    temperature: options.temperature ?? 0,
    files: [],
    fromCache: false,
    model: "",
    promptTokenCount: 0,
    outputTokenCount: 0,
    totalTokens: 0,
    tokensPerSecond: 0,
    durationMs: 0,
    thoughts: null,
  };

  const client = options.ollama instanceof Ollama ? options.ollama : ollama;

  const model = options.model ?? process.env.AI_MODEL;
  if (!model) {
    throw new Error(
      "Model not specified. Use the AI_MODEL environment variable or pass it as an option.",
    );
  }

  detailedData.model = model;

  const hasSchema = options.schemaJson !== undefined;
  const groundedPrompt = hasSchema
    ? `${prompt}\n\nReturn JSON matching this schema exactly:\n${
      JSON.stringify(options.schemaJson)
    }`
    : prompt;

  // Build message
  const message: { role: string; content: string; images?: string[] } = {
    role: "user",
    content: groundedPrompt,
  };
  const fileMessages: { role: string; content: string }[] = [];

  for (const { path, type } of options.files ?? []) {
    if (type === "text") {
      const textContent = readFileSync(path, { encoding: "utf-8" });
      fileMessages.push({
        role: "user",
        content: `Content from ${path}:\n${textContent}`,
      });
    } else if (type === "image") {
      message.images = message.images ?? [];
      message.images.push(readFileSync(path, { encoding: "base64" }));
    }
  }

  detailedData.prompt = prompt;
  detailedData.systemPrompt = options.systemPrompt ?? null;
  detailedData.thinkingLevel = options.thinkingLevel ?? null;
  detailedData.contextWindow = options.contextWindow ?? null;
  detailedData.temperature = options.temperature ?? 0;
  detailedData.files = options.files ?? [];

  const format = hasSchema ? options.schemaJson as string | object : undefined;

  const params = {
    model,
    messages: [
      ...(options.systemPrompt
        ? [{ role: "system", content: options.systemPrompt }]
        : []),
      message,
      ...fileMessages,
    ],
    format,
    temperature: options.temperature ?? 0,
    contextWindow: options.contextWindow,
    think: options.thinkingLevel,
  };

  // Cache check
  const cacheFiles = (options.cache ?? true) ? initCache(params) : null;
  if (cacheFiles) {
    const processCachedResponse = hasSchema || options.processResponse
      ? async (response: unknown): Promise<TResponse> => {
        const validatedResponse = validateStructuredResponse(
          response,
          options.schemaJson,
        );
        return options.processResponse
          ? await options.processResponse(validatedResponse)
          : validatedResponse as TResponse;
      }
      : undefined;
    const hit = await readAndProcessCache<
      OllamaDetailedResponse,
      TResponse
    >(cacheFiles.cacheFile, processCachedResponse);
    if (hit !== null) {
      return { ...hit, fromCache: true };
    }
  }

  // API call
  const result = await client.chat({
    model,
    messages: params.messages,
    format: params.format,
    options: {
      temperature: params.temperature,
      num_ctx: options.contextWindow,
    },
    think: params.think,
    ...(options.ollamaParameters ?? {}),
    stream: false,
  });

  const thoughts = result.message.thinking ?? null;
  const returnedResponse = result.message.content ?? "";

  // Post-process
  const response = processResponse(returnedResponse, {
    parseJson: hasSchema,
  });
  const validatedResponse = validateStructuredResponse(
    response,
    options.schemaJson,
  );

  detailedData.response = validatedResponse;

  // Metrics
  const promptTokenCount = result.prompt_eval_count ?? 0;
  const outputTokenCount = result.eval_count ?? 0;
  const totalTokens = promptTokenCount + outputTokenCount;
  const durationMs = Date.now() - start;
  const durationSeconds = durationMs / 1000;
  const tokensPerSecond = totalTokens / durationSeconds;

  detailedData.promptTokenCount = promptTokenCount;
  detailedData.outputTokenCount = outputTokenCount;
  detailedData.totalTokens = totalTokens;
  detailedData.tokensPerSecond = tokensPerSecond;
  detailedData.durationMs = durationMs;
  detailedData.thoughts = thoughts;

  const processedResponse = options.processResponse
    ? await options.processResponse(validatedResponse)
    : validatedResponse as TResponse;

  if (cacheFiles) {
    writeCache(cacheFiles.cacheFile, detailedData);
  }

  return { ...detailedData, response: processedResponse };
}
