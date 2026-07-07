import { readFileSync } from "node:fs";
import process from "node:process";
import ollama, { type ChatRequest, Ollama } from "ollama";
import { initCache, readCache, writeCache } from "./helpers/cache.ts";
import { processResponse } from "./helpers/processResponse.ts";

/** The detailed response shape returned by {@link askOllama}. */
type OllamaDetailedResponse = {
  response: unknown;
  fromCache: boolean;
  prompt: string;
  files: { path: string; type: "image" | "text" }[];
  promptTokenCount: number;
  outputTokenCount: number;
  totalTokens: number;
  tokensPerSecond: number;
  durationMs: number;
  model: string;
  thoughts: string;
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
 * **Caching**: set `cache: true` to persist responses in `.journalism-cache`.
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
 * @param options.cache - Cache the response in `.journalism-cache`.
 * @param options.contextWindow - Override the model's context window size.
 * @param options.thinkingLevel - Enables reasoning. Pass `true` for models that only support on/off, or `"low"`, `"medium"`, or `"high"` for granular control.
 * @param options.temperature - Sampling temperature (default 0).
 * @param options.ollamaParameters - Extra params merged into `client.chat`.
 *
 * @category AI
 */
export default async function askOllama(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    ollama?: Ollama;
    files?: { path: string; type: "image" | "text" }[];
    schemaJson?: unknown;
    cache?: boolean;
    contextWindow?: number;
    thinkingLevel?: boolean | "low" | "medium" | "high";
    temperature?: number;
    ollamaParameters?: Partial<ChatRequest>;
  } = {},
): Promise<{
  /** The model's response, parsed as a JSON value when `schemaJson` was provided, otherwise a plain string. */
  response: unknown;
  /** `true` when the result was served from the local file cache. */
  fromCache: boolean;
  /** The primary text prompt (unchanged; text files are sent as separate user messages, images as attachments). */
  prompt: string;
  /** Files passed to the model alongside the prompt. */
  files: { path: string; type: "image" | "text" }[];
  /** Number of tokens in the prompt. */
  promptTokenCount: number;
  /** Number of tokens in the model's response. */
  outputTokenCount: number;
  /** Total tokens (prompt + output). */
  totalTokens: number;
  /** Tokens processed per second. */
  tokensPerSecond: number;
  /** Wall-clock time of the API call in milliseconds. */
  durationMs: number;
  /** The model name used for this call. */
  model: string;
  /** The model's internal reasoning text (only populated when thinking is enabled). */
  thoughts: string;
}> {
  const start = Date.now();

  const detailedData: OllamaDetailedResponse = {
    response: undefined,
    prompt: prompt,
    files: [],
    fromCache: false,
    model: "",
    promptTokenCount: 0,
    outputTokenCount: 0,
    totalTokens: 0,
    tokensPerSecond: 0,
    durationMs: 0,
    thoughts: "",
  };

  const client = options.ollama instanceof Ollama ? options.ollama : ollama;

  const model = options.model ?? process.env.AI_MODEL;
  if (!model) {
    throw new Error(
      "Model not specified. Use the AI_MODEL environment variable or pass it as an option.",
    );
  }

  detailedData.model = model;

  // Build message
  const message: { role: string; content: string; images?: string[] } = {
    role: "user",
    content: prompt,
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
  detailedData.files = options.files ?? [];

  const format = options.schemaJson ? options.schemaJson : undefined;

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
  const cacheFiles = options.cache ? initCache(params) : null;
  if (cacheFiles) {
    const hit = readCache(cacheFiles.cacheFile);
    if (hit !== null) {
      return { ...(hit as OllamaDetailedResponse), fromCache: true };
    }
  }

  // API call
  const result = await client.chat({
    model,
    messages: params.messages,
    format: params.format,
    options: {
      temperature: 0,
      num_ctx: options.contextWindow,
    },
    think: options.thinkingLevel,
    ...(options.ollamaParameters ?? {}),
    stream: false,
  });

  const thoughts = result.message.thinking ?? "";
  const returnedResponse = result.message.content ?? "";

  // Post-process
  const response = processResponse(returnedResponse, {
    parseJson: !!options.schemaJson,
  });

  detailedData.response = response;

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

  if (cacheFiles) {
    writeCache(cacheFiles.cacheFile, detailedData);
  }

  return detailedData;
}
