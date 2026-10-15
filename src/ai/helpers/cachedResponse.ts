import { z } from "zod";

const common = {
  response: z.unknown(),
  fromCache: z.boolean(),
  prompt: z.string(),
  systemPrompt: z.string().nullable(),
  promptTokenCount: z.number(),
  outputTokenCount: z.number(),
  totalTokens: z.number(),
  // JSON serializes a zero-duration rate (Infinity or NaN) as null.
  tokensPerSecond: z.number().nullable(),
  durationMs: z.number(),
  model: z.string(),
  thoughts: z.string().nullable(),
};

export const geminiCachedResponse = z.looseObject({
  ...common,
  webSearch: z.boolean(),
  thinkingLevel: z.enum(["minimal", "low", "medium", "high"]).nullable(),
  safetyEnabled: z.boolean(),
  files: z.array(
    z.looseObject({ path: z.string(), type: z.enum(["image", "video", "audio", "pdf", "text"]) }),
  ),
  estimatedCost: z.number().nullable(),
  thoughtsTokenCount: z.number(),
});

export const ollamaCachedResponse = z.looseObject({
  ...common,
  thinkingLevel: z.union([z.boolean(), z.enum(["low", "medium", "high"])]).nullable(),
  contextWindow: z.number().nullable(),
  temperature: z.number(),
  files: z.array(z.looseObject({ path: z.string(), type: z.enum(["image", "text"]) })),
});
