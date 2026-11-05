import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { createHash } from "node:crypto";
import { generateText, Output, type JSONValue, type LanguageModel, type UserContent } from "ai";
import { fromJSONSchema, z } from "zod";
import { generationModel, generationProvider } from "./helpers/generationModel.ts";
import { initCache, readAndProcessCache, writeCache } from "./helpers/cache.ts";

/**
 * Generates text or validated structured data through one shared provider interface.
 *
 * Select `openai`, `anthropic`, `gemini`, `vertex` (Gemini Enterprise Agent
 * Platform), or `ollama`. Omit `provider` to use `AI_PROVIDER`, falling back to
 * Gemini or the legacy Google project/Ollama environment configuration. Vertex
 * can also be selected with `provider: "gemini", vertex: true`.
 *
 * Alternatively, pass an AI SDK model adapter implementing the v4 specification
 * (used by AI SDK 7) as `model`. Configure
 * its credentials and deployment on that adapter. Supply a non-secret `cacheKey`
 * identifying its deployment and model settings when caching is enabled. No Vercel account or
 * gateway is required for the built-in providers.
 *
 * Original, validated responses are cached in `.journalism-cache` by default.
 * `processResponse` runs on every call, including cache hits, and its output is
 * never cached. Schema and processing failures do not create successful entries;
 * rejected cached entries are removed. Credentials and callbacks are excluded
 * from cache identity. Local attachment contents are included.
 *
 * Structured output uses an internal object envelope so arrays and primitive
 * schemas also have an object root on the wire. The envelope is removed before
 * local validation, processing, caching and return. Provider schema restrictions
 * still apply. Refusals and incomplete responses reject rather than being cached.
 *
 * Sampling defaults are left to the model. Transport retries default to zero;
 * `maxRetries` opts in to AI SDK retries. Application validation is not retried.
 * `beforeRequest` runs before each adapter dispatch, including transport retries,
 * and skips cache hits. Throwing prevents that dispatch.
 *
 * Images and text work with all built-in providers when the model supports them.
 * PDFs work with the cloud providers; audio/video require Gemini or Vertex.
 * `gs://` inputs require Vertex. Local media types are inferred from extensions;
 * use `mediaType` for other extensions. `providerOptions` forwards namespaced AI
 * SDK settings. Ollama accepts `contextWindow`, `thinkingLevel`, and `keepAlive`
 * in `providerOptions.ollama`. Unsupported settings are returned as warnings.
 * Estimated cost is currently unknown (`null`).
 * For mutable GCS inputs, disable caching or change `cacheKey` when the object changes.
 *
 * @example
 * ```ts
 * import { askAI } from "@nshiab/journalism-ai";
 * // Configure OPENAI_API_KEY and AI_MODEL first.
 * const result = await askAI("What is the capital of France?", { provider: "openai" });
 * console.log(result.response);
 * ```
 *
 * @example
 * ```ts
 * import { askAI } from "@nshiab/journalism-ai";
 * import { z } from "zod";
 * // Configure ANTHROPIC_API_KEY and AI_MODEL first.
 * const result = await askAI("List three countries.", {
 *   provider: "anthropic",
 *   schemaJson: z.toJSONSchema(z.array(z.string())),
 *   processResponse: (value) => z.array(z.string()).parse(value),
 * });
 * console.log(result.response.join(", "));
 * ```
 *
 * @example
 * ```ts
 * import { askAI } from "@nshiab/journalism-ai";
 * import { createOpenAI } from "@ai-sdk/openai";
 * // Configure OPENAI_API_KEY first; use a model available to your account.
 * const model = process.env.OPENAI_MODEL;
 * if (!model) throw new Error("Set OPENAI_MODEL first.");
 * const provider = createOpenAI();
 * const result = await askAI("Summarize this article.", {
 *   model: provider.responses(model),
 *   cacheKey: "my-openai-deployment",
 *   files: [{ path: "article.txt", type: "text" }],
 * });
 * console.log(result.response);
 * ```
 *
 * @param prompt - The primary text prompt.
 * @param options - Provider selection, model configuration and response processing.
 * @param options.provider - Explicit provider; otherwise use `AI_PROVIDER` or legacy defaults.
 * @param options.model - Model name (defaults to the provider's `*_MODEL`, then `AI_MODEL`) or an AI SDK model adapter implementing the v4 specification.
 * @param options.apiKey - Explicit provider credential. Environment defaults are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`/`GEMINI_API_KEY`/`AI_KEY`, or `GOOGLE_VERTEX_API_KEY`.
 * @param options.vertex - Compatibility selector for the Vertex backend of Gemini.
 * @param options.project - Vertex project; defaults to `AI_PROJECT` or `GOOGLE_VERTEX_PROJECT`.
 * @param options.location - Vertex location; defaults to `AI_LOCATION`, `GOOGLE_VERTEX_LOCATION`, then `global`.
 * @param options.baseURL - Custom non-secret provider endpoint. Ollama also reads `OLLAMA_HOST`.
 * @param options.cacheKey - Non-secret deployment/configuration identity required for cached custom adapters; also usable to version remote attachments.
 * @param options.systemPrompt - Optional system instruction.
 * @param options.schemaJson - JSON Schema for structured output and local validation.
 * @param options.processResponse - Synchronous or asynchronous validation/transformation, rerun on cache hits.
 * @param options.files - Ordered local attachments or Vertex GCS URLs.
 * @param options.cache - Enable response caching; defaults to `true`.
 * @param options.temperature - Optional sampling temperature; no forced default.
 * @param options.maxOutputTokens - Optional output-token limit.
 * @param options.reasoning - Shared AI SDK reasoning setting, subject to model support.
 * @param options.webSearch - Enable provider-native web search; unsupported for Ollama and custom adapters.
 * @param options.providerOptions - Namespaced AI SDK provider settings, excluding credentials.
 * @param options.maxRetries - Transport/API retry count; defaults to zero.
 * @param options.beforeRequest - Called immediately before each uncached adapter dispatch.
 * @param options.abortSignal - Cancels model generation.
 * @param options.fetch - Custom transport for built-in adapters; configure custom adapters directly instead.
 * @returns The response with provider, cache, usage, reasoning, timing and warning metadata.
 * @category AI
 */
export default function askAI<TResponse = unknown>(
  prompt: string,
  options?: {
    provider?: "openai" | "anthropic" | "gemini" | "vertex" | "ollama";
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
    vertex?: boolean;
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
  options: Options = {},
): Promise<DetailedResponse> {
  const start = Date.now();
  options.abortSignal?.throwIfAborted();
  const custom = typeof options.model === "object" ? options.model : undefined;
  if (
    custom &&
    (options.provider !== undefined ||
      options.apiKey !== undefined ||
      options.vertex !== undefined ||
      options.project !== undefined ||
      options.location !== undefined ||
      options.baseURL !== undefined ||
      options.fetch !== undefined ||
      options.webSearch)
  ) {
    throw new Error(
      "Configure provider selection, credentials, endpoints and transport on a custom model adapter; webSearch is only available for built-in cloud providers.",
    );
  }
  if (custom && (custom.specificationVersion !== "v4" || !custom.provider || !custom.modelId))
    throw new Error(
      "A custom model must implement the AI SDK v4 model specification with provider and modelId.",
    );
  if (custom && (options.cache ?? true) && !options.cacheKey?.trim())
    throw new Error(
      "Provide a non-secret cacheKey identifying the custom model deployment, or set cache: false.",
    );
  const provider = custom?.provider ?? generationProvider(options);
  const modelName =
    custom?.modelId ??
    (typeof options.model === "string"
      ? options.model
      : (process.env[`${provider.toUpperCase()}_MODEL`] ?? process.env.AI_MODEL));
  if (!modelName?.trim())
    throw new Error(
      "Model not specified. Pass model or configure the provider's model environment variable or AI_MODEL.",
    );
  const selected = custom
    ? {
        model: custom,
        identity: { provider, model: modelName, deployment: options.cacheKey },
        tools: undefined,
      }
    : generationModel({ ...options, provider: generationProvider(options), model: modelName });
  const model = selected.model;
  const { content, fileIdentity } = generationFiles(prompt, options.files ?? [], provider);
  const schema =
    options.schemaJson === undefined
      ? undefined
      : fromJSONSchema(
          typeof options.schemaJson === "boolean"
            ? options.schemaJson
            : z.record(z.string(), z.unknown()).parse(options.schemaJson),
        );
  if (options.schemaJson === false)
    throw new Error("schemaJson: false cannot produce a valid response.");
  const maxRetries = options.maxRetries ?? 0;
  if (!Number.isInteger(maxRetries) || maxRetries < 0)
    throw new Error("maxRetries must be a non-negative integer.");
  const validate = (response: unknown): unknown =>
    schema ? schema.parse(response) : z.string().parse(response);
  const processValue = async (response: unknown): Promise<unknown> => {
    options.abortSignal?.throwIfAborted();
    const validated = validate(response);
    const processed = options.processResponse
      ? await options.processResponse(validated)
      : validated;
    options.abortSignal?.throwIfAborted();
    return processed;
  };
  const cacheFiles =
    (options.cache ?? true)
      ? initCache({
          operation: "askAI-v1",
          identity: selected.identity,
          cacheKey: options.cacheKey,
          prompt,
          systemPrompt: options.systemPrompt,
          files: fileIdentity,
          schemaJson: options.schemaJson,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          reasoning: options.reasoning,
          webSearch: options.webSearch ?? false,
          providerOptions: options.providerOptions,
        })
      : null;
  if (cacheFiles) {
    const hit = await readAndProcessCache(
      cacheFiles.cacheFile,
      (value): DetailedResponse => cachedGeneration.parse(value),
      processValue,
    );
    if (hit !== null) return { ...hit, fromCache: true };
  }
  const guardedModel: typeof model = {
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    modelId: model.modelId,
    supportedUrls: model.supportedUrls,
    async doGenerate(request) {
      request.abortSignal?.throwIfAborted();
      await options.beforeRequest?.();
      request.abortSignal?.throwIfAborted();
      return model.doGenerate(request);
    },
    doStream: (request) => model.doStream(request),
  };
  const result = await generateText({
    model: guardedModel,
    system: options.systemPrompt,
    messages: [{ role: "user", content }],
    output: schema ? Output.object({ schema: z.object({ response: schema }) }) : undefined,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    reasoning: options.reasoning,
    tools: selected.tools,
    providerOptions: options.providerOptions,
    maxRetries,
    abortSignal: options.abortSignal,
  });
  if (result.finishReason !== "stop")
    throw new Error(`Model response did not complete successfully (${result.finishReason}).`);
  const response = validate(
    schema ? z.object({ response: z.unknown() }).parse(result.output).response : result.text,
  );
  if (!schema && result.text.length === 0)
    throw new Error("Model returned no text response (possibly a refusal).");
  const durationMs = Date.now() - start;
  const usage = result.totalUsage;
  const totalTokens = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  const data: DetailedResponse = {
    response,
    fromCache: false,
    provider,
    model: modelName,
    prompt,
    systemPrompt: options.systemPrompt ?? null,
    promptTokenCount: usage.inputTokens ?? 0,
    outputTokenCount: usage.outputTokens ?? 0,
    thoughtsTokenCount: usage.outputTokenDetails.reasoningTokens ?? 0,
    totalTokens,
    tokensPerSecond: durationMs > 0 ? totalTokens / (durationMs / 1000) : null,
    durationMs,
    thoughts: result.reasoningText ?? null,
    estimatedCost: null,
    finishReason: result.finishReason,
    sources: result.sources.flatMap((source) =>
      source.sourceType === "url" ? [{ url: source.url, title: source.title }] : [],
    ),
    warnings: (result.warnings ?? []).map((warning) => ({
      type: warning.type,
      message:
        "message" in warning
          ? warning.message
          : `${warning.feature}${warning.details ? `: ${warning.details}` : ""}`,
    })),
  };
  const processed = await processValue(cacheFiles ? structuredClone(response) : response);
  if (cacheFiles) writeCache(cacheFiles.cacheFile, data);
  return { ...data, response: processed };
}

type Options = NonNullable<Parameters<typeof askAI>[1]>;
type DetailedResponse = Awaited<ReturnType<typeof askAI>>;
type FileIdentity = {
  path: string;
  type: NonNullable<Options["files"]>[number]["type"];
  mediaType: string;
  contentHash: string | null;
};

const cachedGeneration = z.object({
  response: z.unknown(),
  fromCache: z.boolean(),
  provider: z.string(),
  model: z.string(),
  prompt: z.string(),
  systemPrompt: z.string().nullable(),
  promptTokenCount: z.number(),
  outputTokenCount: z.number(),
  thoughtsTokenCount: z.number(),
  totalTokens: z.number(),
  tokensPerSecond: z.number().nullable(),
  durationMs: z.number(),
  thoughts: z.string().nullable(),
  estimatedCost: z.number().nullable(),
  finishReason: z.literal("stop"),
  sources: z.array(z.object({ url: z.string(), title: z.string().optional() })),
  warnings: z.array(z.object({ type: z.string(), message: z.string() })),
});

/** Builds ordered content and hashes local bytes so edited files cannot reuse stale responses. */
function generationFiles(
  prompt: string,
  files: NonNullable<Options["files"]>,
  provider: string,
): {
  content: UserContent;
  fileIdentity: FileIdentity[];
} {
  const content: UserContent = [{ type: "text", text: prompt }];
  const fileIdentity: FileIdentity[] = [];
  const mediaTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  for (const file of files) {
    if (provider === "ollama" && file.type !== "image" && file.type !== "text")
      throw new Error("Ollama supports text and image files only.");
    if (
      (provider === "openai" || provider === "anthropic") &&
      (file.type === "audio" || file.type === "video")
    )
      throw new Error(`${provider} audio/video inputs are not supported by askAI.`);
    const remote = file.path.startsWith("gs://");
    if (remote && provider !== "vertex")
      throw new Error("gs:// files require the Vertex provider.");
    const mediaType =
      file.mediaType ??
      (file.type === "text" ? "text/plain" : mediaTypes[extname(file.path).toLowerCase()]);
    if (
      !mediaType ||
      !(file.type === "pdf"
        ? mediaType === "application/pdf"
        : mediaType.startsWith(`${file.type}/`))
    )
      throw new Error(`Provide a matching mediaType for ${file.path} (${file.type}).`);
    const bytes = remote ? undefined : readFileSync(file.path);
    fileIdentity.push({
      ...file,
      mediaType,
      contentHash: bytes ? createHash("sha256").update(bytes).digest("hex") : null,
    });
    if (file.type === "text" && bytes) content.push({ type: "text", text: bytes.toString("utf8") });
    else content.push({ type: "file", data: bytes ?? new URL(file.path), mediaType });
  }
  return { content, fileIdentity };
}
