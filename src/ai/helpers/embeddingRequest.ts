import type { JSONValue, EmbeddingModel } from "ai";
import { z } from "zod";
import type getEmbedding from "../getEmbedding.ts";
import type getEmbeddingIdentity from "../getEmbeddingIdentity.ts";
import { providerDeployment, requireCredentials, resolveProvider } from "./provider.ts";

type Options = NonNullable<Parameters<typeof getEmbedding>[1]>;
type Model = Extract<EmbeddingModel, { specificationVersion: "v4" }>;

/** Resolves one non-secret embedding identity for provider calls, caches and downstream data. */
export function resolveEmbeddingRequest(
  options: Options,
  environment: Record<string, string | undefined> = process.env,
) {
  const provider = resolveProvider(
    options.provider ?? environment.AI_EMBEDDINGS_PROVIDER ?? environment.AI_PROVIDER,
  );
  if (provider === "anthropic")
    throw new Error(
      "Anthropic has no native embedding model. Set AI_EMBEDDINGS_PROVIDER to an embedding provider.",
    );
  const model = options.model ?? environment.AI_EMBEDDINGS_MODEL;
  if (!model?.trim()) throw new Error("Set AI_EMBEDDINGS_MODEL or pass model.");
  const deployment = providerDeployment(provider, options, environment);
  if (provider !== "ollama" && options.contextWindow !== undefined)
    throw new Error("contextWindow is only valid for Ollama embeddings.");
  const contextWindow =
    options.contextWindow === undefined
      ? undefined
      : z.number().int().positive().parse(options.contextWindow);
  const providerOptions: { [provider: string]: { [key: string]: JSONValue } } = z
    .record(z.string(), z.record(z.string(), z.json()))
    .parse(options.providerOptions ?? {});
  if (provider === "ollama" && Object.keys(providerOptions).length)
    throw new Error("Use contextWindow for Ollama embeddings instead of providerOptions.");
  const settings =
    provider === "openai"
      ? providerOptions.openai
      : provider === "gemini"
        ? providerOptions.google
        : (providerOptions.googleVertex ?? providerOptions.vertex ?? providerOptions.google);
  const configuredDimensions =
    provider === "openai" ? settings?.dimensions : settings?.outputDimensionality;
  if (
    options.dimensions !== undefined &&
    configuredDimensions !== undefined &&
    options.dimensions !== configuredDimensions
  )
    throw new Error("dimensions conflicts with providerOptions.");
  const requestedDimensions = options.dimensions ?? configuredDimensions;
  const dimensions =
    requestedDimensions === undefined
      ? undefined
      : z.number().int().positive().parse(requestedDimensions);
  if (provider === "ollama" && dimensions !== undefined)
    throw new Error("Ollama does not support the dimensions option.");
  const identity: ReturnType<typeof getEmbeddingIdentity> = {
    schemaVersion: 3,
    provider,
    model,
    endpoint: deployment.endpoint,
    authentication: deployment.authentication,
    ...(deployment.project === undefined ? {} : { project: deployment.project }),
    ...(deployment.location === undefined ? {} : { location: deployment.location }),
    ...(dimensions === undefined ? {} : { dimensions }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    providerOptions,
  };
  return { provider, model, deployment, identity, dimensions, contextWindow, providerOptions };
}

/** Loads the selected cloud embedding adapter or wraps the official Ollama client. */
export async function embeddingModel(
  resolved: ReturnType<typeof resolveEmbeddingRequest>,
  customFetch?: typeof globalThis.fetch,
): Promise<Model> {
  const { provider, model, deployment } = resolved;
  requireCredentials(deployment);
  if (provider === "ollama") {
    const { Ollama } = await import("ollama");
    return {
      specificationVersion: "v4",
      provider: "ollama",
      modelId: model,
      maxEmbeddingsPerCall: 1,
      supportsParallelCalls: true,
      async doEmbed(request) {
        const client = new Ollama({
          host: deployment.endpoint,
          fetch: (input, init) =>
            (customFetch ?? globalThis.fetch)(input, {
              ...init,
              signal:
                request.abortSignal && init?.signal
                  ? AbortSignal.any([request.abortSignal, init.signal])
                  : (request.abortSignal ?? init?.signal),
            }),
        });
        const response = await client.embed({
          model,
          input: request.values,
          options: { num_ctx: resolved.contextWindow },
        });
        return {
          embeddings: response.embeddings,
          usage: { tokens: response.prompt_eval_count },
          warnings: [],
        };
      },
    };
  }
  if (provider === "openai") {
    const { createOpenAI } = await import("@ai-sdk/openai");
    return createOpenAI({
      apiKey: deployment.apiKey,
      baseURL: deployment.endpoint,
      fetch: customFetch,
    }).embeddingModel(model);
  }
  if (provider === "gemini") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    return createGoogleGenerativeAI({
      apiKey: deployment.apiKey,
      baseURL: deployment.endpoint,
      fetch: customFetch,
    }).embeddingModel(model);
  }
  const { createVertex } = await import("@ai-sdk/google-vertex");
  return createVertex({
    apiKey: deployment.apiKey ?? "",
    project: deployment.project,
    location: deployment.location,
    baseURL: deployment.endpoint,
    fetch: customFetch,
  }).embeddingModel(model);
}
