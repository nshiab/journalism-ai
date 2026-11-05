import type { LanguageModel, ToolSet } from "ai";
import { providerDeployment, requireCredentials, type Provider } from "./provider.ts";

type Model = Extract<LanguageModel, { specificationVersion: "v4" }>;

/** Loads only the selected provider adapter and configures its direct API connection. */
export async function generationModel(
  options: {
    provider: Provider;
    model: string;
    apiKey?: string;
    project?: string;
    location?: string;
    baseURL?: string;
    fetch?: typeof globalThis.fetch;
    webSearch?: boolean;
  },
  environment: Record<string, string | undefined> = process.env,
): Promise<{
  model: Model;
  identity: {
    provider: Provider;
    model: string;
    endpoint: string;
    project?: string;
    location?: string;
    authentication: string;
  };
  tools?: ToolSet;
}> {
  const { provider, model, fetch: customFetch } = options;
  const deployment = providerDeployment(provider, options, environment);
  requireCredentials(deployment);
  const identity = {
    provider,
    model,
    endpoint: deployment.endpoint,
    project: deployment.project,
    location: deployment.location,
    authentication: deployment.authentication,
  };
  if (provider === "ollama") {
    if (options.webSearch) throw new Error("Ollama web search is not supported.");
    const { ollamaLanguageModel } = await import("./ollamaLanguageModel.ts");
    return {
      model: ollamaLanguageModel(model, { host: deployment.endpoint, fetch: customFetch }),
      identity,
    };
  }
  if (provider === "openai") {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const client = createOpenAI({
      apiKey: deployment.apiKey,
      baseURL: deployment.endpoint,
      fetch: customFetch,
    });
    return {
      model: client.responses(model),
      identity,
      tools: options.webSearch ? { web_search: client.tools.webSearch({}) } : undefined,
    };
  }
  if (provider === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const client = createAnthropic({
      apiKey: deployment.apiKey,
      baseURL: deployment.endpoint,
      fetch: customFetch,
    });
    return {
      model: client(model),
      identity,
      tools: options.webSearch ? { web_search: client.tools.webSearch_20250305({}) } : undefined,
    };
  }
  if (provider === "gemini") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const client = createGoogleGenerativeAI({
      apiKey: deployment.apiKey,
      baseURL: deployment.endpoint,
      fetch: customFetch,
    });
    return {
      model: client(model),
      identity,
      tools: options.webSearch ? { google_search: client.tools.googleSearch({}) } : undefined,
    };
  }
  const { createVertex } = await import("@ai-sdk/google-vertex");
  // Empty explicitly disables the SDK's vendor-specific key environment fallback.
  const client = createVertex({
    apiKey: deployment.apiKey ?? "",
    project: deployment.project,
    location: deployment.location,
    baseURL: options.baseURL,
    fetch: customFetch,
  });
  return {
    model: client(model),
    identity,
    tools: options.webSearch ? { google_search: client.tools.googleSearch({}) } : undefined,
  };
}
