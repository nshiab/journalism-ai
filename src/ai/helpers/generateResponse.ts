import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { createHash } from "node:crypto";
import { generateText, Output, type UserContent } from "ai";
import { fromJSONSchema, z } from "zod";
import type askAI from "../askAI.ts";
import { generationModel } from "./generationModel.ts";
import { resolveProvider } from "./provider.ts";
import estimateGeminiCost from "./estimateGeminiCost.ts";
import { initCache, readAndProcessCache, writeCache } from "./cache.ts";

/** Shared generation, validation, processing and caching implementation. */
export async function generateResponse(
  prompt: string,
  options: Options = {},
  providerValue?: unknown,
  environment: Record<string, string | undefined> = process.env,
): Promise<DetailedResponse> {
  const start = Date.now();
  options.abortSignal?.throwIfAborted();
  const custom = typeof options.model === "object" ? options.model : undefined;
  if (
    custom &&
    (options.apiKey !== undefined ||
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
  const selectedProvider = providerValue ?? environment.AI_PROVIDER;
  if (typeof selectedProvider !== "string" || !selectedProvider.trim())
    throw new Error("Set AI_PROVIDER before calling askAI.");
  const provider = custom ? selectedProvider : resolveProvider(selectedProvider);
  const modelName =
    custom?.modelId ?? (typeof options.model === "string" ? options.model : environment.AI_MODEL);
  if (!modelName?.trim()) throw new Error("Set AI_MODEL or pass model.");
  const selected = custom
    ? {
        model: custom,
        identity: {
          provider,
          adapter: custom.provider,
          model: modelName,
          deployment: options.cacheKey,
        },
        tools: undefined,
      }
    : await generationModel(
        { ...options, provider: resolveProvider(provider), model: modelName },
        environment,
      );
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
          operation: "askAI-v2",
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
    estimatedCost:
      provider === "gemini"
        ? estimateGeminiCost(
            modelName,
            usage.inputTokens ?? 0,
            Math.max(
              0,
              (usage.outputTokens ?? 0) - (usage.outputTokenDetails.reasoningTokens ?? 0),
            ),
            usage.outputTokenDetails.reasoningTokens ?? 0,
            (options.files ?? []).some((file) => file.type === "audio"),
          )
        : null,
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
    if (remote && provider !== "google-agent-platform")
      throw new Error("gs:// files require google-agent-platform.");
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
