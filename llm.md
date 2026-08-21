# The Journalism library (AI functions)

To install the library with Deno, use:

```bash
deno add jsr:@nshiab/journalism-ai
```

To install the library with Node.js, use:

```bash
npm i @nshiab/journalism-ai
```

To import a function, use:

```ts
import { functionName } from "@nshiab/journalism-ai";
```

## askGemini

Interacts with Google's Gemini models to perform a wide range of tasks, from
answering questions to analyzing multimedia content.

**Authentication**: set `AI_KEY` (API key) or `AI_PROJECT` + `AI_LOCATION`
(Vertex AI) environment variables, or pass credentials directly via options.

**Caching**: responses are persisted in `.journalism-cache` by default. Set
`cache: false` to disable caching.

**File handling**: pass files via `files: [{ path, type }]`. Local paths and
`gs://` GCS URLs are both supported for images, audio, video, PDF, and text.

**Web Search Grounding**: set `webSearch: true` to let the model search the web
in real time (extra API cost).

Safety filters are on by default (`true`) but off when using Vertex AI
(`false`); override with `safetyEnabled`.

### Signature

```typescript
async function askGemini<TResponse>(
  prompt: string,
  options?: AskGeminiOptions<TResponse>,
): Promise<GeminiDetailedResponse<TResponse>>;
```

### Parameters

- **`prompt`**: The primary text prompt.
- **`options.systemPrompt`**: Optional system prompt.
- **`options.model`**: Model name; defaults to `AI_MODEL` env var.
- **`options.apiKey`**: API key; defaults to `AI_KEY` env var.
- **`options.vertex`**: Use Vertex AI authentication.
- **`options.project`**: GCP project ID; defaults to `AI_PROJECT` env var.
- **`options.location`**: GCP location; defaults to `AI_LOCATION` env var.
- **`options.webSearch`**: Enable web search grounding (extra cost).
- **`options.files`**: Files to send alongside the prompt, in order. Each entry
  has a `path` (local path or `gs://` URL) and a `type` (`"image"`, `"video"`,
  `"audio"`, `"pdf"`, or `"text"`). All files are appended as separate content
  parts after the prompt.
- **`options.schemaJson`**: Zod JSON schema for structured output.
- **`options.cache`**: Cache the response in `.journalism-cache`. Defaults to
  `true`.
- **`options.processResponse`**: Transform or validate the response before it is
  returned. If it rejects a cached response, that cache entry is removed so a
  retry can generate a fresh response.
- **`options.thinkingBudget`**: Reasoning token budget. Use `0` to disable
  thinking, `-1` for a dynamic budget, or a positive number for a fixed budget.
  Ignored when `thinkingLevel` is provided.
- **`options.thinkingLevel`**: Thinking level: "minimal" | "low" | "medium" |
  "high".
- **`options.temperature`**: Sampling temperature sent to Gemini.
- **`options.safetyEnabled`**: Override safety filter defaults.
- **`options.geminiParameters`**: Extra params merged into `generateContent`.

### Examples

```ts
const result = await askGemini("What is the capital of France?");
console.log(result.response); // "Paris"
```

```ts
// Pass credentials directly.
const response = await askGemini("What is the capital of France?", {
  apiKey: "your_api_key",
  model: "gemini-3.5-flash",
});

// Vertex AI.
const vertexResponse = await askGemini("What is the capital of France?", {
  vertex: true,
  project: "your_project_id",
  location: "us-central1",
});
```

```ts
// Web search grounding.
const factCheck = await askGemini(
  `Verify: "Renewable energy now accounts for over 30% of global electricity generation."`,
  { webSearch: true },
);
```

```ts
// Structured JSON output with a Zod schema.
import * as z from "zod";
const schema = z.toJSONSchema(
  z.array(z.object({ name: z.string(), age: z.number() })),
);
await askGemini("Give me 10 random people.", { schemaJson: schema });
```

```ts
// Analyse a local image.
const info = await askGemini("Describe this image.", {
  files: [{ path: "./photo.jpg", type: "image" }],
});
```

```ts
// Analyse a file stored in Google Cloud Storage.
const result = await askGemini("Summarize this document.", {
  files: [{ path: "gs://my-bucket/report.pdf", type: "pdf" }],
  vertex: true,
  project: "my-gcp-project",
  location: "us-central1",
});
```

```ts
// Access token usage and estimated cost directly from the response.
const result = await askGemini("What is the capital of France?");
console.log(result.response); // "Paris"
console.log(`${result.totalTokens} tokens, $${result.estimatedCost}`);
```

## askGeminiPool

Processes multiple Gemini requests concurrently using a pool of workers. This
function wraps {@link askGemini} and manages parallel execution, retries,
progress logging, and error handling for batch operations.

Each request in the array is processed by a worker from the pool. The pool size
controls how many requests run simultaneously. Results and errors are returned
separately, sorted by their original index, making it easy to match outputs back
to inputs.

**Caching**: each request uses {@link askGemini}'s default caching behavior, so
responses are persisted in `.journalism-cache` by default. Set
`options.cache: false` on an individual request to disable caching for it.

### Signature

```typescript
function askGeminiPool<TResponse>(
  requests: AskGeminiPoolRequest<TResponse>[],
  poolSize: number,
  poolOptions?: AskGeminiPoolOptions,
): Promise<AskGeminiPoolResult<TResponse>>;
```

### Parameters

- **`requests`**: An array of request objects to process.
- **`requests[].id`**: An optional identifier for the request, useful for
  matching results back to inputs.
- **`requests[].prompt`**: The primary text input for the AI model.
- **`requests[].processResponse`**: An optional function that transforms or
  validates the response inside the retry loop. If it throws, the request is
  retried according to `poolOptions`.
- **`requests[].options`**: Options passed to {@link askGemini} for each
  individual request. Caching defaults to `true`; set `cache: false` to disable
  it for that request. See {@link askGemini} for the full list of available
  options.
- **`poolSize`**: The number of concurrent workers processing requests.
- **`poolOptions`**: Configuration for the pool execution.
- **`poolOptions.logProgress`**: If `true`, logs progress to the console after
  each completed or failed request. Defaults to `false`.
- **`poolOptions.retry`**: The maximum number of retry attempts for a failed
  request. Defaults to `0` (no retries).
- **`poolOptions.retryCheck`**: A function that receives the error and returns
  whether the request should be retried. If not provided, all failed requests
  are retried up to the `retry` limit.
- **`poolOptions.minRequestDurationMs`**: A minimum duration in milliseconds for
  each request. If a request completes faster, the worker will wait before
  picking up the next one. Useful for rate limiting.

### Returns

A Promise that resolves to an object with `results` (successful responses with
their index and request) and `errors` (failed requests with their index,
request, and error), both sorted by original index.

### Examples

```ts
// Basic usage: Process a batch of prompts with a pool of 5 concurrent workers.
const { results, errors } = await askGeminiPool(
  [
    { prompt: "What is the capital of France?" },
    { prompt: "What is the capital of Germany?" },
    { prompt: "What is the capital of Italy?" },
  ],
  5,
);
for (const r of results) {
  console.log(r.result.response);
}
```

```ts
// Use an id to easily identify each request in the results.
const { results, errors } = await askGeminiPool(
  [
    { id: "france", prompt: "What is the capital of France?" },
    { id: "germany", prompt: "What is the capital of Germany?" },
  ],
  2,
);
for (const r of results) {
  console.log(r.request.id, r.result.response);
}
```

```ts
// Enable progress logging and retries.
const { results, errors } = await askGeminiPool(
  [
    {
      prompt: "Summarize this article.",
      options: {
        files: [{ path: "./article1.txt", type: "text" }],
        schemaJson: schema,
      },
    },
    {
      prompt: "Summarize this article.",
      options: {
        files: [{ path: "./article2.txt", type: "text" }],
        schemaJson: schema,
      },
    },
  ],
  3,
  {
    logProgress: true,
    retry: 2,
  },
);
console.log(`${results.length} succeeded, ${errors.length} failed`);
```

```ts
// Use retryCheck to only retry on specific errors.
const { results, errors } = await askGeminiPool(
  [
    {
      prompt: "Analyze this image.",
      options: {
        files: [{ path: "./photo.jpg", type: "image" }],
        schemaJson: schema,
      },
    },
  ],
  1,
  {
    retry: 3,
    retryCheck: (error) => {
      // Only retry on rate limit errors
      return error instanceof Error && error.message.includes("429");
    },
  },
);
```

```ts
// Use schemaJson to enforce structured output with a specific schema.
import * as z from "zod";

const schema = z.toJSONSchema(
  z.object({
    people: z.array(z.object({
      name: z.string(),
      age: z.number(),
      gender: z.enum(["man", "woman"]),
    })),
  }),
);

const { results, errors } = await askGeminiPool(
  [
    {
      prompt: "Give me 5 characters from Harry Potter.",
      options: { schemaJson: schema },
    },
    {
      prompt: "Give me 5 characters from Lord of the Rings.",
      options: { schemaJson: schema },
    },
  ],
  2,
);
// Each result.response will conform to the specified schema
for (const r of results) {
  console.log(r.result.response); // { people: [{ name: "...", age: ..., gender: "..." }, ...] }
}
```

## askOllama

Interacts with a local Ollama model to perform a wide range of tasks.

Ollama must be running on the machine. Set the `AI_MODEL` environment variable
or pass `model` directly.

Pass a custom `Ollama` instance via the `ollama` option to target a non-default
host.

**File handling**: pass local files via `files: [{ path, type }]`. Only
`"image"` and `"text"` types are supported for now.

**Caching**: responses are persisted in `.journalism-cache` by default. Set
`cache: false` to disable caching.

Temperature defaults to 0 for deterministic responses.

### Signature

```typescript
async function askOllama<TResponse>(
  prompt: string,
  options?: AskOllamaOptions<TResponse>,
): Promise<OllamaDetailedResponse<TResponse>>;
```

### Parameters

- **`prompt`**: The primary text prompt.
- **`options.model`**: Model name; defaults to `AI_MODEL` env var.
- **`options.ollama`**: Custom `Ollama` instance targeting a specific host.
- **`options.systemPrompt`**: Optional system prompt.
- **`options.files`**: Files to send alongside the prompt. Only `"image"` and
  `"text"` types are supported (local paths only; no GCS, audio, video, or PDF).
  Text files are sent as separate user messages after the prompt; images are
  sent as attachments to the prompt message.
- **`options.schemaJson`**: JSON schema for structured output.
- **`options.cache`**: Cache the response in `.journalism-cache`. Defaults to
  `true`.
- **`options.contextWindow`**: Override the model's context window size.
- **`options.thinkingLevel`**: Enables reasoning. Pass `true` for models that
  only support on/off, or `"low"`, `"medium"`, or `"high"` for granular control.
- **`options.temperature`**: Sampling temperature (default 0).
- **`options.ollamaParameters`**: Extra params merged into `client.chat`.
- **`options.processResponse`**: Transform or validate the response before it is
  returned. If it rejects a cached response, that cache entry is removed so a
  retry can generate a fresh response.

### Examples

```ts
// Assumes AI_MODEL is set in environment variables.
const result = await askOllama("What is the capital of France?");
console.log(result.response); // "Paris"
```

```ts
// Use a custom Ollama instance.
import { Ollama } from "ollama";
const client = new Ollama({ host: "http://127.0.0.1:11434" });
const result = await askOllama("What is the capital of France?", {
  ollama: client,
});
```

```ts
// Analyse a local image.
const result = await askOllama("Describe this image.", {
  files: [{ path: "./photo.jpg", type: "image" }],
});
```

```ts
// Structured JSON output.
import * as z from "zod";
const schema = z.toJSONSchema(
  z.object({ country: z.string(), capital: z.string() }),
);
const result = await askOllama(
  "What is the capital of France?",
  { schemaJson: schema },
);
```

```ts
// Enable thinking / reasoning.
const result = await askOllama(
  "What is 17 * 23?",
  { thinkingLevel: "low" },
);
```

```ts
// Access token usage directly from the response.
const result = await askOllama("What is the capital of France?");
console.log(result.response); // "Paris"
console.log(`${result.totalTokens} tokens in ${result.durationMs}ms`);
```

## getEmbedding

Generates a numerical embedding (vector representation) for a given text string.
Embeddings are crucial for various natural language processing (NLP) tasks,
including semantic search, text classification, clustering, and anomaly
detection, as they allow text to be processed and compared mathematically.

This function supports both Google's Gemini AI models and local models running
with Ollama. It provides options for authentication, model selection, and
caching to optimize performance and cost.

**Authentication**: With no explicit provider, credentials, model information,
and provider selection come from environment variables (`AI_KEY`, `AI_PROJECT`,
`AI_LOCATION`, `AI_EMBEDDINGS_MODEL`, `AI_EMBEDDINGS_PROVIDER`). Providerless
options intentionally contain only fields shared by every provider.

**Local Models**: To use a local model with Ollama, pass `provider: "ollama"`,
or set `AI_EMBEDDINGS_PROVIDER=ollama` (the legacy `OLLAMA` environment variable
is also supported), and ensure Ollama is running. A custom `Ollama` client can
be passed in the provider-specific `ollama` option.

**Caching**: Responses are cached by default in a local `.journalism-cache`
directory. If the same request is made again, the cached response will be
returned, avoiding redundant API calls. Set `cache` to `false` to disable
caching. Remember to add `.journalism-cache` to your `.gitignore` file.

### Signature

```typescript
async function getEmbedding(
  text: string,
  options?: GetEmbeddingOptions,
): Promise<number[]>;
```

### Parameters

- **`text`**: The input text string for which to generate the embedding.
- **`options`**: Configuration options for the embedding generation.
- **`options.provider`**: Explicitly selects Gemini/Vertex or Ollama. When
  omitted, `AI_EMBEDDINGS_PROVIDER` is used, then the legacy `OLLAMA` fallback,
  then Gemini.
- **`options.model`**: The specific embedding model to use (e.g.,
  'text-embedding-004'). Defaults to the `AI_EMBEDDINGS_MODEL` environment
  variable.
- **`options.apiKey`**: Your Gemini API or Vertex Express Mode API key. Defaults
  to the `AI_KEY` environment variable.
- **`options.vertex`**: If `true`, explicitly selects the Vertex AI backend for
  the Google provider.
- **`options.project`**: Your Google Cloud project ID for Vertex AI. Defaults to
  the `AI_PROJECT` environment variable.
- **`options.location`**: The Google Cloud location for your Vertex AI project.
  Defaults to the `AI_LOCATION` environment variable.
- **`options.cache`**: If `true`, enables caching of the embedding response.
  Defaults to `true`.
- **`options.ollama`**: A custom Ollama client. Boolean selection remains
  supported at runtime for compatibility but is deprecated; use
  `provider: "ollama"` instead.
- **`options.verbose`**: If `true`, logs additional information such as
  execution time and the truncated input text. Defaults to `false`.
- **`options.contextWindow`**: An option to specify the context window size for
  Ollama models. By default, Ollama sets this depending on the model, which can
  be lower than the actual maximum context window size of the model.

### Returns

A promise that resolves to an array of numbers representing the generated
embedding.

### Examples

```ts
// Environment-selected usage. Configure AI_EMBEDDINGS_PROVIDER,
// AI_EMBEDDINGS_MODEL, and the matching credentials first.
const embedding = await getEmbedding(
  "The quick brown fox jumps over the lazy dog.",
);
console.log(embedding); // [0.012, -0.034, ..., 0.056] (example output)
```

```ts
// Embeddings are cached by default.
const cachedEmbedding = await getEmbedding(
  "Artificial intelligence is transforming industries.",
);
console.log(cachedEmbedding);
```

```ts
// Generate an embedding using a specific model and API key.
const customEmbedding = await getEmbedding(
  "Machine learning is a subset of AI.",
  {
    provider: "gemini",
    model: "another-embedding-model",
    apiKey: "your_custom_api_key",
  },
);
console.log(customEmbedding);
```

```ts
// Explicit Vertex AI usage.
const vertexEmbedding = await getEmbedding("Local reporting matters.", {
  provider: "gemini",
  vertex: true,
  model: "text-embedding-004",
  project: "your-project",
  location: "northamerica-northeast1",
});
```

```ts
// Explicit Ollama usage.
const ollamaEmbedding = await getEmbedding("Local reporting matters.", {
  provider: "ollama",
  model: "nomic-embed-text",
  contextWindow: 8192,
});
```

```ts
// Generate an embedding with verbose logging.
const verboseEmbedding = await getEmbedding(
  "The quick brown fox jumps over the lazy dog.",
  { verbose: true },
);
console.log(verboseEmbedding);
```

## getEmbeddingIdentity

Returns the canonical, non-secret identity for an embedding request. Downstream
persisted data can compare this value to decide whether vectors are compatible
with the current request.

### Signature

```typescript
function getEmbeddingIdentity(
  options?: GetEmbeddingOptions,
  environment?: EmbeddingEnvironment,
): EmbeddingIdentity;
```

### Parameters

- **`options`**: Provider-aware embedding options.
- **`environment`**: Environment used to resolve omitted values.

### Returns

The canonical identity used by embedding caches.

### Examples

```ts
const identity = getEmbeddingIdentity({
  provider: "ollama",
  model: "nomic-embed-text",
  contextWindow: 8192,
});
```
