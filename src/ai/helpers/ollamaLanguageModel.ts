import { Ollama, type Message } from "ollama";
import type { LanguageModel } from "ai";
import { z } from "zod";

type Model = Extract<LanguageModel, { specificationVersion: "v4" }>;

/** Adapts the official Ollama client to the shared non-streaming generation pipeline. */
export function ollamaLanguageModel(
  modelId: string,
  options: { host: string; fetch?: typeof globalThis.fetch },
): Model {
  return {
    specificationVersion: "v4",
    provider: "ollama",
    modelId,
    supportedUrls: {},
    async doGenerate(request) {
      const client = new Ollama({
        host: options.host,
        fetch: (input, init) =>
          (options.fetch ?? globalThis.fetch)(input, {
            ...init,
            signal:
              request.abortSignal && init?.signal
                ? AbortSignal.any([request.abortSignal, init.signal])
                : (request.abortSignal ?? init?.signal),
          }),
      });
      const settings = z
        .strictObject({
          contextWindow: z.number().int().positive().optional(),
          thinkingLevel: z.union([z.boolean(), z.enum(["low", "medium", "high"])]).optional(),
          keepAlive: z.union([z.string(), z.number()]).optional(),
        })
        .parse(request.providerOptions?.ollama ?? {});
      const messages: Message[] = request.prompt.map((message) => {
        if (message.role === "system") return { role: "system", content: message.content };
        if (message.role !== "user")
          throw new Error("Ollama generation supports user and system messages only.");
        const text: string[] = [];
        const images: Uint8Array[] = [];
        for (const part of message.content) {
          if (part.type === "text") text.push(part.text);
          else if (part.mediaType.startsWith("image/") && part.data.type === "data") {
            images.push(
              typeof part.data.data === "string"
                ? Buffer.from(part.data.data, "base64")
                : part.data.data,
            );
          } else throw new Error("Ollama supports local text and image inputs only.");
        }
        return { role: "user", content: text.join("\n\n"), ...(images.length ? { images } : {}) };
      });
      if (request.tools?.length) throw new Error("Ollama web search is not supported.");
      let think = settings.thinkingLevel;
      if (request.reasoning !== undefined && request.reasoning !== "provider-default") {
        if (request.reasoning === "none") think = false;
        else if (["low", "medium", "high"].includes(request.reasoning)) {
          think = z.enum(["low", "medium", "high"]).parse(request.reasoning);
        } else throw new Error("Ollama reasoning must be none, low, medium, or high.");
      }
      request.abortSignal?.throwIfAborted();
      const result = await client.chat({
        model: modelId,
        messages,
        stream: false,
        format:
          request.responseFormat?.type === "json"
            ? request.responseFormat.schema === undefined
              ? "json"
              : z.record(z.string(), z.unknown()).parse(request.responseFormat.schema)
            : undefined,
        think,
        keep_alive: settings.keepAlive,
        options: {
          temperature: request.temperature,
          num_predict: request.maxOutputTokens,
          num_ctx: settings.contextWindow,
        },
      });
      request.abortSignal?.throwIfAborted();
      if (!result.done) throw new Error("Ollama response did not complete.");
      const content: Awaited<ReturnType<Model["doGenerate"]>>["content"] = [];
      if (result.message.thinking)
        content.push({ type: "reasoning", text: result.message.thinking });
      content.push({ type: "text", text: result.message.content });
      return {
        content,
        finishReason: {
          unified: result.done_reason === "length" ? "length" : "stop",
          raw: result.done_reason,
        },
        usage: {
          inputTokens: {
            total: result.prompt_eval_count,
            noCache: result.prompt_eval_count,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: result.eval_count, text: undefined, reasoning: undefined },
        },
        warnings: [],
      };
    },
    doStream() {
      return Promise.reject(new Error("askAI uses non-streaming Ollama generation."));
    },
  };
}
