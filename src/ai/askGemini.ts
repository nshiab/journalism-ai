import { readFileSync } from "node:fs";
import process from "node:process";
import {
  type ContentListUnion,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
  ThinkingLevel,
} from "@google/genai";
import { initCache, readAndProcessCache, writeCache } from "./helpers/cache.ts";
import estimateGeminiCost from "./helpers/estimateGeminiCost.ts";
import { processResponse } from "./helpers/processResponse.ts";

/** A file entry passed to {@link askGemini} via the `files` option. */
export type GeminiFile = {
  /** Local path or `gs://` GCS URL to the file. */
  path: string;
  /** The file's media type. */
  type: "image" | "video" | "audio" | "pdf" | "text";
};

/** The detailed response shape returned by {@link askGemini}. */
export type GeminiDetailedResponse<TResponse = unknown> = {
  response: TResponse;
  fromCache: boolean;
  prompt: string;
  systemPrompt: string | null;
  webSearch: boolean;
  thinkingLevel: "minimal" | "low" | "medium" | "high" | null;
  safetyEnabled: boolean;
  files: GeminiFile[];
  promptTokenCount: number;
  outputTokenCount: number;
  totalTokens: number;
  tokensPerSecond: number;
  estimatedCost: number | null;
  durationMs: number;
  model: string;
  thoughts: string | null;
  thoughtsTokenCount: number;
};

/** Configuration accepted by {@link askGemini}. */
export type AskGeminiOptions<TResponse = unknown> = {
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  vertex?: boolean;
  project?: string;
  location?: string;
  webSearch?: boolean;
  files?: GeminiFile[];
  schemaJson?: unknown;
  cache?: boolean;
  processResponse?: (response: unknown) => TResponse | Promise<TResponse>;
  thinkingBudget?: number;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  temperature?: number;
  safetyEnabled?: boolean;
  // deno-lint-ignore no-explicit-any
  geminiParameters?: any;
};

/**
 * Interacts with Google's Gemini models to perform a wide range of tasks,
 * from answering questions to analyzing multimedia content.
 *
 * **Authentication**: set `AI_KEY` (API key) or `AI_PROJECT` + `AI_LOCATION`
 * (Vertex AI) environment variables, or pass credentials directly via options.
 *
 * **Caching**: set `cache: true` to persist responses in `.journalism-cache`.
 *
 * **File handling**: pass files via `files: [{ path, type }]`. Local paths and
 * `gs://` GCS URLs are both supported for images, audio, video, PDF, and text.
 *
 * **Web Search Grounding**: set `webSearch: true` to let the model search the
 * web in real time (extra API cost).
 *
 * Safety filters are on by default (`true`) but off when using Vertex AI
 * (`false`); override with `safetyEnabled`.
 *
 * @example
 * ```ts
 * const result = await askGemini("What is the capital of France?");
 * console.log(result.response); // "Paris"
 * ```
 *
 * @example
 * ```ts
 * // Pass credentials directly.
 * const response = await askGemini("What is the capital of France?", {
 *   apiKey: "your_api_key",
 *   model: "gemini-3.5-flash",
 * });
 *
 * // Vertex AI.
 * const vertexResponse = await askGemini("What is the capital of France?", {
 *   vertex: true,
 *   project: "your_project_id",
 *   location: "us-central1",
 * });
 * ```
 *
 * @example
 * ```ts
 * // Web search grounding.
 * const factCheck = await askGemini(
 *   `Verify: "Renewable energy now accounts for over 30% of global electricity generation."`,
 *   { webSearch: true },
 * );
 * ```
 *
 * @example
 * ```ts
 * // Structured JSON output with a Zod schema.
 * import * as z from "zod";
 * const schema = z.toJSONSchema(z.array(z.object({ name: z.string(), age: z.number() })));
 * await askGemini("Give me 10 random people.", { schemaJson: schema });
 * ```
 *
 * @example
 * ```ts
 * // Analyse a local image.
 * const info = await askGemini("Describe this image.", {
 *   files: [{ path: "./photo.jpg", type: "image" }],
 * });
 * ```
 *
 * @example
 * ```ts
 * // Analyse a file stored in Google Cloud Storage.
 * const result = await askGemini("Summarize this document.", {
 *   files: [{ path: "gs://my-bucket/report.pdf", type: "pdf" }],
 *   vertex: true,
 *   project: "my-gcp-project",
 *   location: "us-central1",
 * });
 * ```
 *
 * @example
 * ```ts
 * // Access token usage and estimated cost directly from the response.
 * const result = await askGemini("What is the capital of France?");
 * console.log(result.response); // "Paris"
 * console.log(`${result.totalTokens} tokens, $${result.estimatedCost}`);
 * ```
 *
 * @param prompt - The primary text prompt.
 * @param options.systemPrompt - Optional system prompt.
 * @param options.model - Model name; defaults to `AI_MODEL` env var.
 * @param options.apiKey - API key; defaults to `AI_KEY` env var.
 * @param options.vertex - Use Vertex AI authentication.
 * @param options.project - GCP project ID; defaults to `AI_PROJECT` env var.
 * @param options.location - GCP location; defaults to `AI_LOCATION` env var.
 * @param options.webSearch - Enable web search grounding (extra cost).
 * @param options.files - Files to send alongside the prompt, in order. Each entry has a `path` (local path or `gs://` URL) and a `type` (`"image"`, `"video"`, `"audio"`, `"pdf"`, or `"text"`). All files are appended as separate content parts after the prompt.
 * @param options.schemaJson - Zod JSON schema for structured output.
 * @param options.cache - Cache the response in `.journalism-cache`.
 * @param options.processResponse - Transform or validate the response before it is returned. If it rejects a cached response, that cache entry is removed so a retry can generate a fresh response.
 * @param options.thinkingBudget - Reasoning token budget. Use `0` to disable thinking, `-1` for a dynamic budget, or a positive number for a fixed budget. Ignored when `thinkingLevel` is provided.
 * @param options.thinkingLevel - Thinking level: "minimal" | "low" | "medium" | "high".
 * @param options.temperature - Sampling temperature sent to Gemini.
 * @param options.safetyEnabled - Override safety filter defaults.
 * @param options.geminiParameters - Extra params merged into `generateContent`.
 *
 * @category AI
 */
export default async function askGemini<TResponse = unknown>(
  prompt: string,
  options: AskGeminiOptions<TResponse> = {},
): Promise<GeminiDetailedResponse<TResponse>> {
  const start = Date.now();
  const usesVertexAI = options.vertex === true ||
    (!options.apiKey && !options.project && !options.location &&
      Boolean(process.env.AI_PROJECT && process.env.AI_LOCATION));
  const safetyEnabled = options.safetyEnabled ?? !usesVertexAI;

  const detailedData: GeminiDetailedResponse<unknown> = {
    response: undefined,
    prompt: prompt,
    systemPrompt: options.systemPrompt ?? null,
    webSearch: options.webSearch ?? false,
    thinkingLevel: options.thinkingLevel ?? null,
    safetyEnabled,
    files: [],
    fromCache: false,
    model: "",
    promptTokenCount: 0,
    outputTokenCount: 0,
    totalTokens: 0,
    tokensPerSecond: 0,
    estimatedCost: null,
    durationMs: 0,
    thoughts: null,
    thoughtsTokenCount: 0,
  };

  // Auth
  let client: GoogleGenAI;
  if (options.vertex || options.apiKey || options.project || options.location) {
    client = new GoogleGenAI({
      apiKey: options.apiKey,
      vertexai: options.vertex,
      project: options.project,
      location: options.location,
    });
  } else if (process.env.AI_PROJECT && process.env.AI_LOCATION) {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.AI_PROJECT,
      location: process.env.AI_LOCATION,
    });
  } else if (process.env.AI_KEY) {
    client = new GoogleGenAI({
      apiKey: process.env.AI_KEY,
    });
  } else {
    throw new Error(
      "No API key or project/location found. Please set AI_KEY, AI_PROJECT and AI_LOCATION in your environment variables or pass them as options.",
    );
  }

  const model = options.model ?? process.env.AI_MODEL;
  if (!model) {
    throw new Error(
      "Model not specified. Use the AI_MODEL environment variable or pass it as an option.",
    );
  }

  detailedData.model = model;

  // Build contents
  const contents: ContentListUnion = [];

  const mimeTypes: Record<string, string> = {
    image: "image/jpeg",
    audio: "audio/mp3",
    video: "video/mp4",
    pdf: "application/pdf",
  };

  contents.push(prompt);

  for (const { path, type } of options.files ?? []) {
    if (type === "text") {
      if (path.startsWith("gs://")) {
        contents.push({ fileData: { fileUri: path, mimeType: "text/plain" } });
      } else {
        const textContent = readFileSync(path, { encoding: "utf-8" });
        contents.push(textContent);
      }
    } else {
      const mimeType = mimeTypes[type];
      if (path.startsWith("gs://")) {
        contents.push({ fileData: { fileUri: path, mimeType } });
      } else {
        const base64Data = readFileSync(path, { encoding: "base64" });
        contents.push({ inlineData: { data: base64Data, mimeType } });
      }
    }
  }

  detailedData.prompt = prompt;
  detailedData.systemPrompt = options.systemPrompt ?? null;
  detailedData.webSearch = options.webSearch ?? false;
  detailedData.thinkingLevel = options.thinkingLevel ?? null;
  detailedData.files = options.files ?? [];

  detailedData.safetyEnabled = safetyEnabled;

  const safetySettings: SafetySetting[] | undefined = safetyEnabled === false
    ? [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ]
    : undefined;

  const webSearch = options.webSearch ?? false;
  const thinkingLevel = options.thinkingLevel ?? null;

  const params = {
    model,
    contents,
    config: {
      systemInstruction: options.systemPrompt,
      safetySettings,
      responseMimeType: options.schemaJson ? "application/json" : undefined,
      responseJsonSchema: options.schemaJson,
      thinkingConfig: thinkingLevel
        ? {
          thinkingLevel: ThinkingLevel[
            thinkingLevel.toUpperCase() as keyof typeof ThinkingLevel
          ],
          includeThoughts: true,
        }
        : {
          thinkingBudget: options.thinkingBudget ?? 0,
          includeThoughts: (options.thinkingBudget ?? 0) !== 0,
        },
      temperature: options.temperature ?? 0,
      tools: webSearch ? [{ googleSearch: {} }] : undefined,
    },
  };

  // Cache check
  const cacheFiles = options.cache ? initCache(params) : null;
  if (cacheFiles) {
    const hit = await readAndProcessCache<
      GeminiDetailedResponse<unknown>,
      TResponse
    >(cacheFiles.cacheFile, options.processResponse);
    if (hit !== null) {
      return { ...hit, fromCache: true };
    }
  }

  // API call
  const result = await client.models.generateContent({
    ...params,
    ...(options.geminiParameters ?? {}),
  });

  let thoughts: string | null = null;
  let returnedResponse = "";
  const finalUsageMetadata = result.usageMetadata ?? null;

  for (const p of result.candidates?.at(0)?.content?.parts ?? []) {
    if (!p.text) {
      continue;
    } else if (p.thought) {
      thoughts = (thoughts ?? "") + p.text;
    } else {
      returnedResponse += p.text;
    }
  }

  // Post-process
  const response = processResponse(returnedResponse, {
    parseJson: !!options.schemaJson,
  });

  detailedData.response = response;

  // Metrics and pricing
  const durationMs = Date.now() - start;
  const promptTokenCount = finalUsageMetadata?.promptTokenCount ?? 0;
  const outputTokenCount = finalUsageMetadata?.candidatesTokenCount ?? 0;
  const thoughtsTokenCount = finalUsageMetadata?.thoughtsTokenCount ?? 0;
  const totalTokens = finalUsageMetadata?.totalTokenCount ?? 0;
  const tokensPerSecond = totalTokens / (durationMs / 1000);

  detailedData.promptTokenCount = promptTokenCount;
  detailedData.outputTokenCount = outputTokenCount;
  detailedData.totalTokens = totalTokens;
  detailedData.tokensPerSecond = tokensPerSecond;
  detailedData.durationMs = durationMs;
  detailedData.thoughts = thoughts;
  detailedData.thoughtsTokenCount = thoughtsTokenCount;

  if (finalUsageMetadata) {
    const hasAudio = options.files?.some((f) => f.type === "audio") ?? false;
    detailedData.estimatedCost = estimateGeminiCost(
      model,
      promptTokenCount,
      outputTokenCount,
      thoughtsTokenCount,
      hasAudio,
    );
  }

  const processedResponse = options.processResponse
    ? await options.processResponse(detailedData.response)
    : detailedData.response as TResponse;

  if (cacheFiles) {
    writeCache(cacheFiles.cacheFile, detailedData);
  }

  return { ...detailedData, response: processedResponse };
}
