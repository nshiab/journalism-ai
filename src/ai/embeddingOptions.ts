import process from "node:process";

const EMBEDDING_IDENTITY_SCHEMA_VERSION = 2 as const;

/** The service family used to generate an embedding. */
export type EmbeddingProvider = "gemini" | "ollama";

/** The resolved service backend used to generate an embedding. */
export type EmbeddingBackend = "gemini-api" | "vertex" | "ollama";

/** Options shared by every embedding provider. */
export interface EmbeddingCommonOptions {
  /** The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`. */
  model?: string;
  /** Whether to persist and reuse the embedding response. Defaults to `true`. */
  cache?: boolean;
  /** Whether to log request and timing information. */
  verbose?: boolean;
}

/** Options that explicitly select the Gemini API. */
export interface GeminiEmbeddingOptions extends EmbeddingCommonOptions {
  /** Explicitly selects the Google embedding provider. */
  provider: "gemini";
  /** Keeps the request on the Gemini API rather than Vertex AI. */
  vertex?: false;
  /** Gemini API key. Defaults to `AI_KEY`. */
  apiKey?: string;
  /** Vertex projects are not valid for the Gemini API. */
  project?: never;
  /** Vertex locations are not valid for the Gemini API. */
  location?: never;
  /** Ollama clients are not valid for the Gemini API. */
  ollama?: never;
  /** Ollama context windows are not valid for the Gemini API. */
  contextWindow?: never;
}

/** Options that explicitly select Vertex AI. */
export interface VertexEmbeddingOptions extends EmbeddingCommonOptions {
  /** Explicitly selects the Google embedding provider. */
  provider: "gemini";
  /** Selects the Vertex AI backend. */
  vertex: true;
  /** Vertex Express Mode API key. */
  apiKey?: string;
  /** Google Cloud project. Defaults to `AI_PROJECT`. */
  project?: string;
  /** Google Cloud location. Defaults to `AI_LOCATION`. */
  location?: string;
  /** Ollama clients are not valid for Vertex AI. */
  ollama?: never;
  /** Ollama context windows are not valid for Vertex AI. */
  contextWindow?: never;
}

/** Minimal Ollama client contract used for embedding requests. */
export interface OllamaEmbeddingClient {
  /**
   * Non-secret deployment endpoint for custom adapters that are not instances
   * of the Ollama SDK client.
   */
  embeddingEndpoint?: string;
  /** Sends an embedding request to Ollama. */
  embed(request: {
    model: string;
    input: string;
    options?: { num_ctx?: number };
  }): Promise<{ embeddings: number[][] }>;
}

/** Options that explicitly select Ollama. */
export interface OllamaEmbeddingOptions extends EmbeddingCommonOptions {
  /** Explicitly selects Ollama. */
  provider: "ollama";
  /** A custom Ollama client. */
  ollama?: OllamaEmbeddingClient;
  /** The model context-window size sent to Ollama. */
  contextWindow?: number;
  /** Gemini and Vertex API keys are not valid for Ollama. */
  apiKey?: never;
  /** Vertex selection is not valid for Ollama. */
  vertex?: never;
  /** Vertex projects are not valid for Ollama. */
  project?: never;
  /** Vertex locations are not valid for Ollama. */
  location?: never;
}

/**
 * Provider-independent options. The provider, backend, and credentials are
 * selected entirely from the environment.
 */
export interface EnvironmentEmbeddingOptions extends EmbeddingCommonOptions {
  /** Omit the discriminator to select the provider from the environment. */
  provider?: never;
  /** Direct credentials require an explicit provider. */
  apiKey?: never;
  /** Direct backend selection requires an explicit provider. */
  vertex?: never;
  /** Direct deployment selection requires an explicit provider. */
  project?: never;
  /** Direct deployment selection requires an explicit provider. */
  location?: never;
  /** Custom clients require an explicit provider. */
  ollama?: never;
  /** Provider-specific semantic options require an explicit provider. */
  contextWindow?: never;
}

/** Exact provider-aware options accepted by {@link getEmbedding}. */
export type GetEmbeddingOptions =
  | EnvironmentEmbeddingOptions
  | GeminiEmbeddingOptions
  | VertexEmbeddingOptions
  | OllamaEmbeddingOptions;

/** Environment fields used when resolving an embedding request. */
export type EmbeddingEnvironment = Record<string, string | undefined>;

/** Fields shared by every canonical embedding identity. */
export interface EmbeddingIdentityBase {
  /** Cache-compatibility schema for the canonical identity. */
  schemaVersion: 2;
  /** Resolved embedding model. */
  model: string;
}

/** Canonical identity for a Gemini API embedding vector space. */
export interface GeminiEmbeddingIdentity extends EmbeddingIdentityBase {
  /** Resolved provider. */
  provider: "gemini";
  /** Resolved Gemini API backend. */
  backend: "gemini-api";
}

/** Canonical identity for a Vertex AI embedding vector space. */
export interface VertexEmbeddingIdentity extends EmbeddingIdentityBase {
  /** Resolved provider. */
  provider: "gemini";
  /** Resolved Vertex AI backend. */
  backend: "vertex";
  /** Resolved Google Cloud project, when configured. */
  project?: string;
  /** Resolved Google Cloud location, when configured. */
  location?: string;
}

/** Canonical identity for an Ollama embedding vector space. */
export interface OllamaEmbeddingIdentity extends EmbeddingIdentityBase {
  /** Resolved provider. */
  provider: "ollama";
  /** Resolved Ollama backend. */
  backend: "ollama";
  /** Non-secret Ollama endpoint identity. */
  endpoint: string;
  /** Context-window size when explicitly configured. */
  contextWindow?: number;
}

/**
 * Non-secret fields that determine whether two embedding requests share a
 * compatible vector space.
 */
export type EmbeddingIdentity =
  | GeminiEmbeddingIdentity
  | VertexEmbeddingIdentity
  | OllamaEmbeddingIdentity;

type RuntimeEmbeddingOptions = EmbeddingCommonOptions & {
  provider?: EmbeddingProvider;
  apiKey?: string;
  vertex?: boolean;
  project?: string;
  location?: string;
  ollama?: boolean | OllamaEmbeddingClient;
  contextWindow?: number;
};

export interface ResolvedEmbeddingRequest {
  /** Canonical non-secret identity. */
  identity: EmbeddingIdentity;
  /** Resolved Gemini or Vertex API key. */
  apiKey?: string;
  /** Resolved Vertex project. */
  project?: string;
  /** Resolved Vertex location. */
  location?: string;
  /** Custom Ollama client, when provided. */
  ollama?: OllamaEmbeddingClient;
}

function isOllamaEmbeddingClient(
  value: unknown,
): value is OllamaEmbeddingClient {
  return typeof value === "object" && value !== null && "embed" in value &&
    typeof value.embed === "function";
}

function resolveProvider(
  options: RuntimeEmbeddingOptions,
  environment: EmbeddingEnvironment,
): EmbeddingProvider {
  if (options.provider) {
    return options.provider;
  }

  // Runtime support for the pre-provider API. The public option type requires
  // an explicit provider whenever the Ollama-specific field is used.
  if (options.ollama === true || isOllamaEmbeddingClient(options.ollama)) {
    return "ollama";
  }
  if (options.ollama === false) {
    return "gemini";
  }

  const environmentProvider = environment.AI_EMBEDDINGS_PROVIDER;
  if (environmentProvider) {
    if (environmentProvider !== "gemini" && environmentProvider !== "ollama") {
      throw new Error(
        'AI_EMBEDDINGS_PROVIDER must be either "gemini" or "ollama".',
      );
    }
    return environmentProvider;
  }

  return environment.OLLAMA ? "ollama" : "gemini";
}

function sanitizeEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.origin}${pathname}`;
}

function getOllamaEndpoint(client?: OllamaEmbeddingClient): string {
  if (!client) return "http://127.0.0.1:11434";

  const sdkEndpoint = (client as unknown as {
    config?: { host?: unknown };
  }).config?.host;
  const endpoint = client.embeddingEndpoint ??
    (typeof sdkEndpoint === "string" ? sdkEndpoint : undefined);
  if (!endpoint) {
    throw new Error(
      "Custom Ollama embedding clients must provide a non-secret embeddingEndpoint for cache identity.",
    );
  }
  return sanitizeEndpoint(endpoint);
}

/**
 * Resolves the provider, backend, model, deployment, and semantic options once.
 * The returned identity never includes credentials or cache/logging controls.
 */
export function resolveEmbeddingRequest(
  typedOptions: GetEmbeddingOptions = {},
  environment: EmbeddingEnvironment = process.env,
): ResolvedEmbeddingRequest {
  const options = typedOptions as RuntimeEmbeddingOptions;
  const provider = resolveProvider(options, environment);
  const model = options.model ?? environment.AI_EMBEDDINGS_MODEL;
  if (!model) {
    throw new Error(
      "Model not specified. Use the AI_EMBEDDINGS_MODEL environment variable or pass it as an option.",
    );
  }

  if (provider === "ollama") {
    const customClient = isOllamaEmbeddingClient(options.ollama)
      ? options.ollama
      : undefined;
    const identity: OllamaEmbeddingIdentity = {
      schemaVersion: EMBEDDING_IDENTITY_SCHEMA_VERSION,
      provider,
      backend: "ollama",
      model,
      endpoint: getOllamaEndpoint(customClient),
      ...(options.contextWindow === undefined
        ? {}
        : { contextWindow: options.contextWindow }),
    };
    return { identity, ollama: customClient };
  }

  const explicitlySelected = options.provider === "gemini";
  const project = options.project ?? environment.AI_PROJECT;
  const location = options.location ?? environment.AI_LOCATION;
  const vertex = options.vertex === true ||
    (!explicitlySelected && Boolean(project) && Boolean(location));
  const apiKey = options.apiKey ?? environment.AI_KEY;

  if (vertex) {
    const identity: VertexEmbeddingIdentity = {
      schemaVersion: EMBEDDING_IDENTITY_SCHEMA_VERSION,
      provider,
      backend: "vertex",
      model,
      ...(project === undefined ? {} : { project }),
      ...(location === undefined ? {} : { location }),
    };
    return { identity, apiKey, project, location };
  }

  return {
    identity: {
      schemaVersion: EMBEDDING_IDENTITY_SCHEMA_VERSION,
      provider,
      backend: "gemini-api",
      model,
    },
    apiKey,
  };
}

/**
 * Returns the canonical, non-secret identity for an embedding request.
 * Downstream persisted data can compare this value to decide whether vectors
 * are compatible with the current request.
 *
 * @param options Provider-aware embedding options.
 * @param environment Environment used to resolve omitted values.
 * @returns The canonical identity used by embedding caches.
 *
 * @example
 * ```ts
 * const identity = getEmbeddingIdentity({
 *   provider: "ollama",
 *   model: "nomic-embed-text",
 *   contextWindow: 8192,
 * });
 * ```
 *
 * @category AI
 */
export function getEmbeddingIdentity(
  options: GetEmbeddingOptions = {},
  environment: EmbeddingEnvironment = process.env,
): EmbeddingIdentity {
  return resolveEmbeddingRequest(options, environment).identity;
}
