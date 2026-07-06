import { readFileSync } from "node:fs";
import process from "node:process";
import ollama, { type ChatRequest, Ollama } from "ollama";
import { initCache, readCache, writeCache } from "./helpers/cache.ts";
import { processResponse } from "./helpers/processResponse.ts";

/** The detailed response shape returned by {@link askOllama}. */
export type OllamaDetailedResponse = {
  response: unknown;
  fromCache: boolean;
  prompt: string;
  promptTokenCount: number;
  outputTokenCount: number;
  totalTokens: number;
  tokensPerSecond: number;
  durationMs: number;
  model: string;
  thoughts: string;
  thoughtsTokenCount: number;
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
 * **Limitations vs Gemini**: audio, video, and PDF are not supported. GCS
 * (`gs://`) URLs are not supported — use local file paths only.
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
 *   { thinkingBudget: 1 },
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
 * @param options.HTMLFrom - URL(s) whose body HTML is appended to the prompt.
 * @param options.image - Local path(s) to image files.
 * @param options.text - Local path(s) to text files.
 * @param options.schemaJson - JSON schema for structured output.
 * @param options.cache - Cache the response in `.journalism-cache`.
 * @param options.contextWindow - Override the model's context window size.
 * @param options.thinkingBudget - Any non-zero value enables reasoning.
 * @param options.thinkingLevel - Any value enables reasoning.
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
    HTMLFrom?: string | string[];
    image?: string | string[];
    text?: string | string[];
    schemaJson?: unknown;
    cache?: boolean;
    contextWindow?: number;
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    temperature?: number;
    ollamaParameters?: Partial<ChatRequest>;
  } = {},
): Promise<{
  /** The model's response, parsed as a JS object when `schemaJson` was provided, otherwise a plain string. */
  response: unknown;
  /** `true` when the result was served from the local file cache. */
  fromCache: boolean;
  /** The full prompt sent to the model (including any appended file/HTML content). */
  prompt: string;
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
  /** Number of tokens used for internal reasoning (not reported by Ollama; always 0). */
  thoughtsTokenCount: number;
}> {
  const start = Date.now();

  const detailedData: OllamaDetailedResponse = {
    response: undefined,
    prompt: prompt,
    fromCache: false,
    model: "",
    promptTokenCount: 0,
    outputTokenCount: 0,
    totalTokens: 0,
    tokensPerSecond: 0,
    durationMs: 0,
    thoughts: "",
    thoughtsTokenCount: 0,
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
  let promptToBeSent = prompt;
  const message: { role: string; content: string; images?: string[] } = {
    role: "user",
    content: "",
  };

  if (options.HTMLFrom) {
    const urls = Array.isArray(options.HTMLFrom)
      ? options.HTMLFrom
      : [options.HTMLFrom];
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });
        const fullHtml = await res.text();
        const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const html = bodyMatch ? bodyMatch[1] : fullHtml;
        promptToBeSent += `\n\nHTML content from ${url}:\n${html}`;
      } catch (error: unknown) {
        console.log(
          `Problem retrieving body HTML from ${url}:`,
          JSON.stringify(error),
        );
      }
    }
  }

  if (options.text) {
    const textFiles = Array.isArray(options.text)
      ? options.text
      : [options.text];
    for (const textFile of textFiles) {
      if (textFile.startsWith("gs://")) {
        throw new Error(
          "Ollama does not support Google Cloud Storage files. Please use local file paths.",
        );
      }
      const textContent = readFileSync(textFile, { encoding: "utf-8" });
      promptToBeSent += `\n\nContent from ${textFile}:\n${textContent}`;
    }
  }

  message.content = promptToBeSent;

  if (options.image) {
    const imageFiles = Array.isArray(options.image)
      ? options.image
      : [options.image];
    message.images = imageFiles.map((imageFile) =>
      readFileSync(imageFile, { encoding: "base64" })
    );
  }

  detailedData.prompt = promptToBeSent;

  const format = options.schemaJson ? options.schemaJson : undefined;

  const params = {
    model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, message]
      : [message],
    format,
    temperature: options.temperature ?? 0,
    contextWindow: options.contextWindow,
    think: options.thinkingLevel === "minimal"
      ? "low"
      : options.thinkingLevel ?? (options.thinkingBudget ?? 0) > 0,
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
    think: options.thinkingLevel === "minimal"
      ? "low"
      : options.thinkingLevel ?? (options.thinkingBudget ?? 0) > 0,
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
