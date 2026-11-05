import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import type { LanguageModel, ToolSet } from "ai";
import { ollamaLanguageModel } from "./ollamaLanguageModel.ts";

type Model = Extract<LanguageModel, { specificationVersion: "v4" }>;
type Provider = "openai" | "anthropic" | "gemini" | "vertex" | "ollama";

/** Validates a deployment URL before it becomes part of a non-secret cache identity. */
export function generationEndpoint(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "baseURL must be an HTTP(S) URL without credentials, query parameters, or fragments.",
    );
  }
  return url.href.replace(/\/$/, "");
}

/** Resolves provider selection independently of whichever credentials happen to be available. */
export function generationProvider(options: {
  provider?: Provider;
  vertex?: boolean;
  project?: string;
  location?: string;
  apiKey?: string;
}): Provider {
  const selected: unknown =
    options.provider ??
    (options.vertex === undefined ? process.env.AI_PROVIDER : options.vertex ? "vertex" : "gemini");
  let provider: Provider;
  if (selected === undefined) {
    provider =
      options.vertex ||
      options.project ||
      options.location ||
      (!options.apiKey && process.env.AI_PROJECT && process.env.AI_LOCATION)
        ? "vertex"
        : process.env.OLLAMA === "true"
          ? "ollama"
          : "gemini";
  } else if (
    selected === "openai" ||
    selected === "anthropic" ||
    selected === "gemini" ||
    selected === "vertex" ||
    selected === "ollama"
  ) {
    provider = selected;
  } else
    throw new Error("Unsupported AI provider. Use openai, anthropic, gemini, vertex, or ollama.");
  if (options.vertex !== undefined) {
    if (provider !== "gemini" && provider !== "vertex")
      throw new Error("vertex is only valid for Gemini or Vertex.");
    if (provider === "vertex" && options.vertex === false)
      throw new Error("provider: vertex conflicts with vertex: false.");
    if (options.vertex) provider = "vertex";
  }
  if (provider !== "vertex" && (options.project !== undefined || options.location !== undefined)) {
    throw new Error("project and location require the Vertex provider.");
  }
  return provider;
}

/** Creates direct provider adapters and the non-secret deployment identity used for caching. */
export function generationModel(options: {
  provider: Provider;
  model: string;
  apiKey?: string;
  project?: string;
  location?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
  webSearch?: boolean;
}): {
  model: Model;
  identity: {
    provider: Provider;
    model: string;
    endpoint: string | null;
    project?: string;
    location?: string;
    authentication?: "api-key" | "adc";
  };
  tools?: ToolSet;
} {
  const { provider, model, fetch: customFetch } = options;
  const baseURL = options.baseURL === undefined ? undefined : generationEndpoint(options.baseURL);
  if (provider === "ollama") {
    if (options.apiKey !== undefined)
      throw new Error("The local Ollama provider does not accept apiKey.");
    if (options.webSearch) throw new Error("Ollama web search is not supported.");
    const host = baseURL ?? generationEndpoint(process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434");
    return {
      model: ollamaLanguageModel(model, { host, fetch: customFetch }),
      identity: { provider, model, endpoint: host },
    };
  }
  if (provider === "openai") {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Set OPENAI_API_KEY or pass apiKey for OpenAI.");
    const endpoint = baseURL ?? "https://api.openai.com/v1";
    const client = createOpenAI({ apiKey, baseURL: endpoint, fetch: customFetch });
    return {
      model: client.responses(model),
      identity: { provider, model, endpoint },
      tools: options.webSearch ? { web_search: client.tools.webSearch({}) } : undefined,
    };
  }
  if (provider === "anthropic") {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY or pass apiKey for Anthropic.");
    const endpoint = baseURL ?? "https://api.anthropic.com/v1";
    const client = createAnthropic({ apiKey, baseURL: endpoint, fetch: customFetch });
    return {
      model: client(model),
      identity: { provider, model, endpoint },
      tools: options.webSearch ? { web_search: client.tools.webSearch_20250305({}) } : undefined,
    };
  }
  if (provider === "gemini") {
    const apiKey =
      options.apiKey ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
      process.env.GEMINI_API_KEY ??
      process.env.AI_KEY;
    if (!apiKey)
      throw new Error(
        "Set GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, AI_KEY, or pass apiKey for Gemini.",
      );
    const endpoint = baseURL ?? "https://generativelanguage.googleapis.com/v1beta";
    const client = createGoogleGenerativeAI({ apiKey, baseURL: endpoint, fetch: customFetch });
    return {
      model: client(model),
      identity: { provider, model, endpoint },
      tools: options.webSearch ? { google_search: client.tools.googleSearch({}) } : undefined,
    };
  }
  const apiKey = options.apiKey ?? process.env.GOOGLE_VERTEX_API_KEY;
  const project = options.project ?? process.env.AI_PROJECT ?? process.env.GOOGLE_VERTEX_PROJECT;
  const location =
    options.location ?? process.env.AI_LOCATION ?? process.env.GOOGLE_VERTEX_LOCATION ?? "global";
  if (!apiKey && !project)
    throw new Error(
      "Set AI_PROJECT or GOOGLE_VERTEX_PROJECT, or pass project for Vertex ADC authentication.",
    );
  const client = createVertex({ apiKey, project, location, baseURL, fetch: customFetch });
  return {
    model: client(model),
    identity: {
      provider,
      model,
      project,
      location,
      endpoint: baseURL ?? null,
      authentication: apiKey ? "api-key" : "adc",
    },
    tools: options.webSearch ? { google_search: client.tools.googleSearch({}) } : undefined,
  };
}
