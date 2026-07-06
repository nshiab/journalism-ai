import { readFileSync } from "node:fs";
import process from "node:process";
import {
  type Candidate,
  type ContentListUnion,
  GenerateContentResponse,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
  ThinkingLevel,
} from "@google/genai";
import { formatNumber, prettyDuration } from "@nshiab/journalism-format";
import { initCache, readCache, writeCache } from "./helpers/cache.ts";
import { processResponse } from "./helpers/processResponse.ts";

/** The detailed response shape returned by {@link askGemini}. */
export type GeminiDetailedResponse = {
  response: unknown;
  rawResponse: unknown;
  fromCache: boolean;
  prompt: string;
  promptTokenCount: number;
  outputTokenCount: number;
  totalTokens: number;
  tokensPerSecond: number;
  estimatedCost?: number;
  durationMs: number;
  model: string;
  thoughts: string;
  thoughtsTokenCount: number;
};

/**
 * Interacts with Google's Gemini models to perform a wide range of tasks,
 * from answering questions to analysing multimedia content.
 *
 * **Authentication**: set `AI_KEY` (API key) or `AI_PROJECT` + `AI_LOCATION`
 * (Vertex AI) environment variables, or pass credentials directly via options.
 *
 * **Caching**: set `cache: true` to persist responses in `.journalism-cache`.
 *
 * **File handling**: local paths and `gs://` GCS URLs are both supported for
 * images, audio, video, PDF, and text.
 *
 * **Web Search Grounding**: set `webSearch: true` to let the model search the
 * web in real time (extra API cost).
 *
 * Temperature defaults to 0 for deterministic responses. Safety filters are
 * on by default (`true`) but off when using Vertex AI (`false`); override
 * with `safetyEnabled`.
 *
 * @example
 * ```ts
 * const capital = await askGemini("What is the capital of France?");
 * console.log(capital); // "Paris"
 * ```
 *
 * @example
 * ```ts
 * // Pass credentials directly.
 * const response = await askGemini("What is the capital of France?", {
 *   apiKey: "your_api_key",
 *   model: "gemini-2.5-flash",
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
 * await askGemini("Give me 10 random people.", { schemaJson: schema, verbose: true });
 * ```
 *
 * @example
 * ```ts
 * // Analyse a local image.
 * const info = await askGemini("Describe this image.", {
 *   image: "./photo.jpg",
 *   returnJson: true,
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
 * @param options.HTMLFrom - URL(s) whose body HTML is appended to the prompt.
 * @param options.image - Path(s) or `gs://` URL(s) to image files.
 * @param options.video - Path(s) or `gs://` URL(s) to video files.
 * @param options.audio - Path(s) or `gs://` URL(s) to audio files.
 * @param options.pdf - Path(s) or `gs://` URL(s) to PDF files.
 * @param options.text - Path(s) or `gs://` URL(s) to text files.
 * @param options.returnJson - Ask the model to return JSON.
 * @param options.parseJson - Auto-parse the JSON response.
 * @param options.schemaJson - Zod JSON schema for structured output.
 * @param options.cache - Cache the response in `.journalism-cache`.
 * @param options.verbose - Log prompt, response, and token usage.
 * @param options.clean - Transform the response before returning.
 * @param options.test - Assert on the response (throws on failure).
 * @param options.thinkingBudget - Reasoning token budget (0 = off, -1 = dynamic).
 * @param options.thinkingLevel - Thinking level: "minimal" | "low" | "medium" | "high".
 * @param options.includeThoughts - Include reasoning thoughts in output.
 * @param options.temperature - Sampling temperature (default 0).
 * @param options.safetyEnabled - Override safety filter defaults.
 * @param options.geminiParameters - Extra params merged into `generateContentStream`.
 * @param options.metrics - Cumulative metrics object updated after each call.
 *
 * @category AI
 */
export default async function askGemini(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    apiKey?: string;
    vertex?: boolean;
    project?: string;
    location?: string;
    webSearch?: boolean;
    HTMLFrom?: string | string[];
    /** @deprecated Use the `image` option instead. */
    screenshotFrom?: string | string[];
    image?: string | string[];
    video?: string | string[];
    audio?: string | string[];
    pdf?: string | string[];
    text?: string | string[];
    returnJson?: boolean;
    parseJson?: boolean;
    schemaJson?: unknown;
    verbose?: boolean;
    cache?: boolean;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    clean?: (response: unknown) => unknown;
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    includeThoughts?: boolean;
    temperature?: number;
    safetyEnabled?: boolean;
    // deno-lint-ignore no-explicit-any
    geminiParameters?: any;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  } = {},
): Promise<GeminiDetailedResponse> {
  if (options.screenshotFrom) {
    throw new Error(
      "The 'screenshotFrom' option has been removed to reduce dependencies. Please take a screenshot yourself and pass it via the 'image' option.",
    );
  }

  const start = Date.now();

  const defaults = {
    returnJson: options.returnJson || options.schemaJson ? true : false,
    parseJson: options.returnJson || options.schemaJson ? true : false,
  };
  options = { ...defaults, ...options };

  const detailedData: GeminiDetailedResponse = {
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

  // Build contents
  const contents: ContentListUnion = [];
  let promptToBeSent = prompt;

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
        contents.push({
          fileData: { fileUri: textFile, mimeType: "text/plain" },
        });
      } else {
        const textContent = readFileSync(textFile, { encoding: "utf-8" });
        promptToBeSent += `\n\nContent from ${textFile}:\n${textContent}`;
      }
    }
  }

  contents.push(promptToBeSent);

  if (options.audio) {
    const audioFiles = Array.isArray(options.audio)
      ? options.audio
      : [options.audio];
    for (const audioFile of audioFiles) {
      if (audioFile.startsWith("gs://")) {
        contents.push({
          fileData: { fileUri: audioFile, mimeType: "audio/mp3" },
        });
      } else {
        const base64Audio = readFileSync(audioFile, { encoding: "base64" });
        contents.push({
          inlineData: { data: base64Audio, mimeType: "audio/mp3" },
        });
      }
    }
  }

  if (options.video) {
    const videoFiles = Array.isArray(options.video)
      ? options.video
      : [options.video];
    for (const videoFile of videoFiles) {
      if (videoFile.startsWith("gs://")) {
        contents.push({
          fileData: { fileUri: videoFile, mimeType: "video/mp4" },
        });
      } else {
        const base64Video = readFileSync(videoFile, { encoding: "base64" });
        contents.push({
          inlineData: { data: base64Video, mimeType: "video/mp4" },
        });
      }
    }
  }

  if (options.pdf) {
    const pdfFiles = Array.isArray(options.pdf) ? options.pdf : [options.pdf];
    for (const pdfFile of pdfFiles) {
      if (pdfFile.startsWith("gs://")) {
        contents.push({
          fileData: { fileUri: pdfFile, mimeType: "application/pdf" },
        });
      } else {
        const base64Pdf = readFileSync(pdfFile, { encoding: "base64" });
        contents.push({
          inlineData: { data: base64Pdf, mimeType: "application/pdf" },
        });
      }
    }
  }

  if (options.image) {
    const imageFiles = Array.isArray(options.image)
      ? options.image
      : [options.image];
    for (const imageFile of imageFiles) {
      if (imageFile.startsWith("gs://")) {
        contents.push({
          fileData: { fileUri: imageFile, mimeType: "image/jpeg" },
        });
      } else {
        const base64Image = readFileSync(imageFile, { encoding: "base64" });
        contents.push({
          inlineData: { data: base64Image, mimeType: "image/jpeg" },
        });
      }
    }
  }

  detailedData.prompt = promptToBeSent;

  const safetyEnabled = options.safetyEnabled ??
    (options.vertex ? false : true);

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

  const params = {
    model,
    contents,
    config: {
      systemInstruction: options.systemPrompt,
      safetySettings,
      temperature: options.temperature ?? 0,
      responseMimeType: options.returnJson ? "application/json" : undefined,
      responseJsonSchema: options.schemaJson,
      thinkingConfig: options.thinkingLevel
        ? {
          thinkingLevel: ThinkingLevel[
            options.thinkingLevel.toUpperCase() as keyof typeof ThinkingLevel
          ],
          includeThoughts: options.includeThoughts,
        }
        : typeof options.thinkingBudget === "number"
        ? {
          thinkingBudget: options.thinkingBudget ?? 0,
          includeThoughts: options.includeThoughts,
        }
        : {
          thinkingBudget: 0,
          includeThoughts: options.includeThoughts,
        },
      tools: options.webSearch ? [{ googleSearch: {} }] : undefined,
    },
  };

  if (safetyEnabled === false) {
    delete params.config?.safetySettings;
  }

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
  const stream = await client.models.generateContentStream({
    ...params,
    ...(options.geminiParameters ?? {}),
  });

  let thoughts = "";
  let returnedResponse = "";
  let finalUsageMetadata: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  } | null = null;

  try {
    for await (const chunk of stream) {
      if (chunk instanceof GenerateContentResponse) {
        const candidate: Candidate | undefined = chunk.candidates?.at(0);
        const parts = candidate?.content?.parts ?? [];

        if (chunk.usageMetadata) {
          finalUsageMetadata = chunk.usageMetadata;
        }

        for (const p of parts) {
          if (!p.text) {
            continue;
          } else if (p.thought) {
            if (options.verbose && !thoughts) {
              process.stdout.write("\nThoughts:\n");
            }
            if (options.verbose) {
              process.stdout.write(p.text);
            }
            thoughts += p.text;
          } else {
            if (options.verbose) {
              if (!returnedResponse) {
                process.stdout.write("\nResponse:\n");
              }
              process.stdout.write(p.text);
            }
            returnedResponse += p.text;
          }
        }
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

  // Metrics and pricing
  if (finalUsageMetadata) {
    const hasAudio = options.audio ? true : false;

    const pricing = [
      {
        model: "gemini-3.5-flash",
        input: 1.50,
        output: 9.00,
      },
      {
        model: "gemini-3.1-pro",
        tiers: [
          { threshold: 200_000, input: 2.00, output: 12.00 },
          { threshold: Infinity, input: 4.00, output: 18.00 },
        ],
      },
      {
        model: "gemini-3.1-flash",
        input: hasAudio ? 1.00 : 0.50,
        output: 3.00,
      },
      {
        model: "gemini-3.1-flash-lite",
        input: hasAudio ? 0.50 : 0.25,
        output: 1.50,
      },
      {
        model: "gemini-3-pro",
        tiers: [
          { threshold: 200_000, input: 2.00, output: 12.00 },
          { threshold: Infinity, input: 4.00, output: 18.00 },
        ],
      },
      {
        model: "gemini-3-flash",
        input: hasAudio ? 1.00 : 0.50,
        output: 3.00,
      },
      {
        model: "gemini-2.5-pro",
        tiers: [
          { threshold: 200_000, input: 1.25, output: 10.00 },
          { threshold: Infinity, input: 2.50, output: 15.00 },
        ],
      },
      {
        model: "gemini-2.5-flash",
        input: hasAudio ? 1.00 : 0.30,
        output: 2.50,
      },
      {
        model: "gemini-2.5-flash-lite",
        input: hasAudio ? 0.30 : 0.10,
        output: 0.40,
      },
      {
        model: "gemini-2.0-flash",
        input: hasAudio ? 0.20 : 0.10,
        output: 0.40,
      },
      {
        model: "gemini-2.0-flash-lite",
        input: 0.075,
        output: 0.30,
      },
      {
        model: "gemini-1.5-pro",
        tiers: [
          { threshold: 128_000, input: 1.25, output: 5.00 },
          { threshold: Infinity, input: 2.50, output: 10.00 },
        ],
      },
      {
        model: "gemini-1.5-flash",
        tiers: [
          { threshold: 128_000, input: 0.075, output: 0.30 },
          { threshold: Infinity, input: 0.15, output: 0.60 },
        ],
      },
    ];

    const modelPricing = pricing.find((p) =>
      p.model === model.replace("-preview", "")
    );
    if (!modelPricing) {
      if (options.verbose) {
        console.log(
          `\nModel ${model.replace("-preview", "")} not found in pricing list.`,
        );
      }
    } else {
      const promptTokenCount = finalUsageMetadata.promptTokenCount ?? 0;
      const outputTokenCount = finalUsageMetadata.candidatesTokenCount ?? 0;
      const thoughtsTokenCount = finalUsageMetadata.thoughtsTokenCount ?? 0;

      let inputRate: number;
      let outputRate: number;

      if ("tiers" in modelPricing && modelPricing.tiers) {
        const tier = modelPricing.tiers.find((t) =>
          promptTokenCount <= t.threshold
        ) || modelPricing.tiers[modelPricing.tiers.length - 1];
        inputRate = tier.input;
        outputRate = tier.output;

        if (options.verbose) {
          const tierDescription = tier.threshold === Infinity
            ? `> ${formatNumber(modelPricing.tiers[0].threshold)} tokens`
            : `≤ ${formatNumber(tier.threshold)} tokens`;
          console.log(
            `\nPricing tier: ${tierDescription}${
              hasAudio ? " (audio pricing applied)" : ""
            }`,
          );
        }
      } else if ("input" in modelPricing && "output" in modelPricing) {
        inputRate = modelPricing.input;
        outputRate = modelPricing.output;
      } else {
        if (options.verbose) {
          console.log(`\nInvalid pricing structure for model ${model}.`);
        }
        const durationMs = Date.now() - start;
        const totalTokens = promptTokenCount + outputTokenCount +
          thoughtsTokenCount;
        const tokensPerSecond = totalTokens / (durationMs / 1000);

        detailedData.promptTokenCount = promptTokenCount;
        detailedData.outputTokenCount = outputTokenCount;
        detailedData.totalTokens = totalTokens;
        detailedData.tokensPerSecond = tokensPerSecond;
        detailedData.durationMs = durationMs;
        detailedData.thoughts = thoughts;
        detailedData.thoughtsTokenCount = thoughtsTokenCount;

        return detailedData;
      }

      const promptTokenCost = (promptTokenCount / 1_000_000) * inputRate;
      const outputTokenCost = (outputTokenCount / 1_000_000) * outputRate;
      const estimatedCost = promptTokenCost + outputTokenCost;

      const totalTokens = promptTokenCount + outputTokenCount +
        thoughtsTokenCount;
      const durationMs = Date.now() - start;
      const durationSeconds = durationMs / 1000;
      const tokensPerSecond = totalTokens / durationSeconds;

      detailedData.promptTokenCount = promptTokenCount;
      detailedData.outputTokenCount = outputTokenCount;
      detailedData.totalTokens = totalTokens;
      detailedData.tokensPerSecond = tokensPerSecond;
      detailedData.estimatedCost = estimatedCost;
      detailedData.durationMs = durationMs;
      detailedData.thoughts = thoughts;
      detailedData.thoughtsTokenCount = thoughtsTokenCount;

      if (options.metrics) {
        options.metrics.totalCost += estimatedCost;
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
          formatNumber(detailedData.thoughtsTokenCount),
          "/",
          "Tokens per second:",
          formatNumber(detailedData.tokensPerSecond, {
            significantDigits: 1,
          }),
          "/",
          `Estimated cost${options.webSearch ? " (web search excluded)" : ""}:`,
          formatNumber(detailedData.estimatedCost!, {
            prefix: "$",
            significantDigits: 1,
            suffix: " USD",
          }),
        );
      }
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
