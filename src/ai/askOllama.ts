import { readFileSync } from "node:fs";
import process from "node:process";
import { formatNumber, prettyDuration } from "@nshiab/journalism-format";
import ollama, { type ChatRequest, Ollama } from "ollama";
import { initCache, readCache, writeCache } from "./helpers/cache.ts";
import { processResponse } from "./helpers/processResponse.ts";

/** The detailed response shape returned by {@link askOllama}. */
export type OllamaDetailedResponse = {
  response: unknown;
  rawResponse: unknown;
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
 * // Assumes OLLAMA=true and AI_MODEL are set in environment variables.
 * const capital = await askOllama("What is the capital of France?");
 * console.log(capital); // "Paris"
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
 * const result = await askOllama(
 *   "What is the capital of France? Return JSON: {country: string, capital: string}",
 *   { returnJson: true, verbose: true },
 * );
 * ```
 *
 * @example
 * ```ts
 * // Enable thinking / reasoning.
 * const result = await askOllama(
 *   "What is 17 * 23?",
 *   { thinkingBudget: 1, verbose: true },
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
 * @param options.returnJson - Ask the model to return JSON.
 * @param options.parseJson - Auto-parse the JSON response.
 * @param options.schemaJson - JSON schema for structured output.
 * @param options.cache - Cache the response in `.journalism-cache`.
 * @param options.verbose - Log prompt, response, and token usage.
 * @param options.clean - Transform the response before returning.
 * @param options.test - Assert on the response (throws on failure).
 * @param options.contextWindow - Override the model's context window size.
 * @param options.thinkingBudget - Any non-zero value enables reasoning.
 * @param options.thinkingLevel - Any value enables reasoning.
 * @param options.includeThoughts - Include reasoning thoughts in output.
 * @param options.temperature - Sampling temperature (default 0).
 * @param options.ollamaParameters - Extra params merged into `client.chat`.
 * @param options.metrics - Cumulative metrics object updated after each call.
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
    returnJson?: boolean;
    parseJson?: boolean;
    schemaJson?: unknown;
    verbose?: boolean;
    cache?: boolean;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    clean?: (response: unknown) => unknown;
    contextWindow?: number;
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    includeThoughts?: boolean;
    temperature?: number;
    ollamaParameters?: Partial<ChatRequest>;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  } = {},
): Promise<OllamaDetailedResponse> {
  const start = Date.now();

  const defaults = {
    returnJson: options.returnJson || options.schemaJson ? true : false,
    parseJson: options.returnJson || options.schemaJson ? true : false,
  };
  options = { ...defaults, ...options };

  const detailedData: OllamaDetailedResponse = {
    response: undefined,
    prompt: prompt,
    rawResponse: undefined,
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

  if (options.verbose) {
    if (options.systemPrompt) {
      console.log(`\nSystem prompt:`);
      console.log(options.systemPrompt);
    }
    console.log(`\nPrompt to ${model}:`);
    console.log(prompt);
    if (options.schemaJson) {
      console.log(`JSON schema for response:`);
      console.log(JSON.stringify(options.schemaJson, null, 2));
    }
  }

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
        const fetchStart = options.verbose ? new Date() : null;
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
        if (fetchStart) {
          console.log(
            `\nRetrieved body HTML from ${url} in ${
              prettyDuration(fetchStart)
            }`,
          );
        }
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

  const format = options.schemaJson
    ? options.schemaJson
    : options.returnJson
    ? "json"
    : undefined;

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
  let cacheFileJSON = "";
  let cacheFileText = "";
  if (options.cache) {
    const cacheFiles = initCache(params, options.clean, options.test);
    cacheFileJSON = cacheFiles.cacheFileJSON;
    cacheFileText = cacheFiles.cacheFileText;
    const hit = readCache(cacheFileJSON, cacheFileText, {
      verbose: options.verbose,
    });
    if (hit !== null) {
      return { ...detailedData, response: hit.response, fromCache: true };
    }
  }

  // API call
  const stream = await client.chat({
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
    stream: true,
  });

  let thoughts = "";
  let returnedResponse = "";
  let finalOllamaResponse: {
    prompt_eval_count: number;
    eval_count: number;
  } | null = null;

  try {
    for await (const chunk of stream) {
      finalOllamaResponse = chunk;

      if (chunk.message.thinking) {
        if (options.verbose && !thoughts) {
          process.stdout.write("\nThoughts:\n");
        }
        if (options.verbose) {
          process.stdout.write(chunk.message.thinking);
        }
        thoughts += chunk.message.thinking;
      } else if (chunk.message.content) {
        if (options.verbose) {
          if (!returnedResponse) {
            process.stdout.write("\nResponse:\n");
          }
          process.stdout.write(chunk.message.content);
        }
        returnedResponse += chunk.message.content;
      }
    }
  } finally {
    if (
      "abort" in stream &&
      typeof (stream as { abort?: unknown }).abort === "function"
    ) {
      (stream as { abort: () => void }).abort();
    }
    if (options.verbose) {
      process.stdout.write("\n");
    }
  }

  // Post-process
  const { cleaned, raw } = processResponse(returnedResponse, {
    parseJson: options.parseJson,
    clean: options.clean,
    test: options.test,
    verbose: options.verbose,
  });

  // Cache write
  if (options.cache) {
    writeCache(
      cacheFileJSON,
      cacheFileText,
      cleaned,
      options.parseJson ?? false,
      options.verbose,
    );
  }

  detailedData.response = cleaned;
  detailedData.rawResponse = raw !== cleaned ? raw : undefined;

  // Metrics
  if (finalOllamaResponse) {
    const promptTokenCount = finalOllamaResponse.prompt_eval_count;
    const outputTokenCount = finalOllamaResponse.eval_count;
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

    if (options.metrics) {
      options.metrics.totalInputTokens += promptTokenCount;
      options.metrics.totalOutputTokens += outputTokenCount;
      options.metrics.totalRequests += 1;
    }

    if (options.verbose) {
      console.log(
        `\n\nTokens in:`,
        formatNumber(detailedData.promptTokenCount),
        "/",
        "Tokens out:",
        formatNumber(detailedData.outputTokenCount),
        "/",
        "Thinking tokens:",
        "N/A",
        "/",
        "Tokens per second:",
        formatNumber(detailedData.tokensPerSecond, {
          significantDigits: 1,
        }),
      );
    }
  } else {
    detailedData.durationMs = Date.now() - start;
    detailedData.thoughts = thoughts;
  }

  if (options.verbose) {
    console.log("Execution time:", prettyDuration(start), "\n");
  }

  return detailedData;
}
