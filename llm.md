**Journalism AI v2.0.8**

***

# The Journalism Library (AI functions)

Useful TypeScript functions for AI in journalism projects.
Part of the [journalism library](https://github.com/nshiab/journalism).

The library is maintained by [Nael Shiab](https://naelshiab.com/), computational
journalist and senior data producer for [CBC News](https://www.cbc.ca/news).

> [!TIP]
> To learn how to use this library and more, check out
> [Code Like a Journalist](https://www.code-like-a-journalist.com/), a free and
> open-source data analysis and data visualization course in TypeScript. You
> might also find
> [simple-data-analysis](https://github.com/nshiab/simple-data-analysis) useful.

## Installation

Requires **Node.js 24.21.0 or later**.

```sh
npm install @nshiab/journalism-ai
```

```ts
import { askGemini } from "@nshiab/journalism-ai";

// Set AI_KEY and AI_MODEL in your environment first.
const result = await askGemini("What is the capital of France?");
console.log(result.response);
```

To start a data project with folders, configuration and documentation for AI
agents, run:

```sh
npx @nshiab/setup-data-project
```

## Documentation

- [Documentation](https://nshiab.github.io/journalism-ai/)
- [llms.txt — Documentation index for AI agents](https://nshiab.github.io/journalism-ai/llms.txt)
- [llm.md — Complete Markdown reference](https://nshiab.github.io/journalism-ai/llm.md),
  for AI assistants or offline reading
- [npm package](https://www.npmjs.com/package/@nshiab/journalism-ai)

See
[CONTRIBUTING.md](https://github.com/nshiab/journalism-ai/blob/main/CONTRIBUTING.md)
for development commands.

## AI

### askGemini()

> **askGemini**\<`TResponse`\>(`prompt`, `options?`): `Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `files`: `object`[]; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `response`: `TResponse`; `safetyEnabled`: `boolean`; `systemPrompt`: `string` \| `null`; `thinkingLevel`: `"minimal"` \| `"low"` \| `"medium"` \| `"high"` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `webSearch`: `boolean`; \}\>

Interacts with Google's Gemini models to perform a wide range of tasks,
from answering questions to analyzing multimedia content.

**Authentication**: set `AI_KEY` (API key) or `AI_PROJECT` + `AI_LOCATION`
(Vertex AI) environment variables, or pass credentials directly via options.

**Caching**: responses are persisted in `.journalism-cache` by default. Set
`cache: false` to disable caching.

**File handling**: pass files via `files: [{ path, type }]`. Local paths and
`gs://` GCS URLs are both supported for images, audio, video, PDF, and text.

**Web Search Grounding**: set `webSearch: true` to let the model search the
web in real time (extra API cost).

Safety filters are on by default (`true`) but off when using Vertex AI
(`false`); override with `safetyEnabled`.

#### Type Parameters

##### TResponse

`TResponse` = `unknown`

#### Parameters

##### prompt

`string`

The primary text prompt.

##### options?

###### apiKey?

`string`

API key; defaults to `AI_KEY` env var.

###### cache?

`boolean`

Cache the response in `.journalism-cache`. Defaults to `true`.

###### files?

`object`[]

Files to send alongside the prompt, in order. Each entry has a `path` (local path or `gs://` URL) and a `type` (`"image"`, `"video"`, `"audio"`, `"pdf"`, or `"text"`). All files are appended as separate content parts after the prompt.

###### geminiParameters?

`Partial`\<`GenerateContentParameters`\>

Extra params merged into `generateContent`.

###### location?

`string`

GCP location; defaults to `AI_LOCATION` env var.

###### model?

`string`

Model name; defaults to `AI_MODEL` env var.

###### processResponse?

(`response`) => `TResponse` \| `Promise`\<`TResponse`\>

Transform or validate the response before returning it; rejected cached responses are removed.

###### project?

`string`

GCP project ID; defaults to `AI_PROJECT` env var.

###### safetyEnabled?

`boolean`

Override safety filter defaults.

###### schemaJson?

`unknown`

Zod JSON schema for structured output.

###### systemPrompt?

`string`

Optional system prompt.

###### temperature?

`number`

Sampling temperature sent to Gemini.

###### thinkingBudget?

`number`

Reasoning token budget. Use `0` to disable thinking, `-1` for a dynamic budget, or a positive number for a fixed budget. Ignored when `thinkingLevel` is provided.

###### thinkingLevel?

`"minimal"` \| `"low"` \| `"medium"` \| `"high"`

Thinking level: "minimal" | "low" | "medium" | "high".

###### vertex?

`boolean`

Use Vertex AI authentication.

###### webSearch?

`boolean`

Enable web search grounding (extra cost).

#### Returns

`Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `files`: `object`[]; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `response`: `TResponse`; `safetyEnabled`: `boolean`; `systemPrompt`: `string` \| `null`; `thinkingLevel`: `"minimal"` \| `"low"` \| `"medium"` \| `"high"` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `webSearch`: `boolean`; \}\>

#### Examples

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
const schema = z.toJSONSchema(z.array(z.object({ name: z.string(), age: z.number() })));
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

***

### askGeminiPool()

> **askGeminiPool**\<`TResponse`\>(`requests`, `poolSize`, `poolOptions?`): `Promise`\<\{ `errors`: `object`[]; `results`: `object`[]; \}\>

Processes multiple Gemini requests concurrently using a pool of workers. This function wraps [askGemini](#askgemini) and manages parallel execution, retries, progress logging, and error handling for batch operations.

Each request in the array is processed by a worker from the pool. The pool size controls how many requests run simultaneously. Results and errors are returned separately, sorted by their original index, making it easy to match outputs back to inputs.

**Caching**: each request uses [askGemini](#askgemini)'s default caching behavior, so
responses are persisted in `.journalism-cache` by default. Set
`options.cache: false` on an individual request to disable caching for it.

#### Type Parameters

##### TResponse

`TResponse` = `unknown`

#### Parameters

##### requests

`object`[]

An array of request objects to process.

##### poolSize

`number`

The number of concurrent workers processing requests.

##### poolOptions?

Configuration for the pool execution.

###### logProgress?

`boolean`

If `true`, logs progress to the console after each completed or failed request. Defaults to `false`.

###### minRequestDurationMs?

`number`

A minimum duration in milliseconds for each request. If a request completes faster, the worker will wait before picking up the next one. Useful for rate limiting.

###### retry?

`number`

The maximum number of retry attempts for a failed request. Defaults to `0` (no retries).

###### retryCheck?

(`error`) => `boolean` \| `Promise`\<`boolean`\>

A function that receives the error and returns whether the request should be retried. If not provided, all failed requests are retried up to the `retry` limit.

#### Returns

`Promise`\<\{ `errors`: `object`[]; `results`: `object`[]; \}\>

A Promise that resolves to an object with `results` (successful responses with their index and request) and `errors` (failed requests with their index, request, and error), both sorted by original index.

#### Examples

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
    { prompt: "Summarize this article.", options: { files: [{ path: "./article1.txt", type: "text" }], schemaJson: schema } },
    { prompt: "Summarize this article.", options: { files: [{ path: "./article2.txt", type: "text" }], schemaJson: schema } },
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
    { prompt: "Analyze this image.", options: { files: [{ path: "./photo.jpg", type: "image" }], schemaJson: schema } },
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
    { prompt: "Give me 5 characters from Harry Potter.", options: { schemaJson: schema } },
    { prompt: "Give me 5 characters from Lord of the Rings.", options: { schemaJson: schema } },
  ],
  2,
);
// Each result.response will conform to the specified schema
for (const r of results) {
  console.log(r.result.response); // { people: [{ name: "...", age: ..., gender: "..." }, ...] }
}
```

***

### askOllama()

> **askOllama**\<`TResponse`\>(`prompt`, `options?`): `Promise`\<\{ `contextWindow`: `number` \| `null`; `durationMs`: `number`; `files`: `object`[]; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `response`: `TResponse`; `systemPrompt`: `string` \| `null`; `temperature`: `number`; `thinkingLevel`: `boolean` \| `"low"` \| `"medium"` \| `"high"` \| `null`; `thoughts`: `string` \| `null`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; \}\>

Interacts with a local Ollama model to perform a wide range of tasks.

Ollama must be running on the machine. Set the `AI_MODEL` environment
variable or pass `model` directly.

Pass a custom `Ollama` instance via the `ollama` option to target a
non-default host.

**File handling**: pass local files via `files: [{ path, type }]`. Only `"image"`
and `"text"` types are supported for now.

**Caching**: responses are persisted in `.journalism-cache` by default. Set
`cache: false` to disable caching.

Temperature defaults to 0 for deterministic responses.

#### Type Parameters

##### TResponse

`TResponse` = `unknown`

#### Parameters

##### prompt

`string`

The primary text prompt.

##### options?

###### cache?

`boolean`

Cache the response in `.journalism-cache`. Defaults to `true`.

###### contextWindow?

`number`

Override the model's context window size.

###### files?

`object`[]

Files to send alongside the prompt. Only `"image"` and `"text"` types are supported (local paths only; no GCS, audio, video, or PDF). Text files are sent as separate user messages after the prompt; images are sent as attachments to the prompt message.

###### model?

`string`

Model name; defaults to `AI_MODEL` env var.

###### ollama?

`unknown`

Custom `Ollama` instance targeting a specific host.

###### ollamaParameters?

`Partial`\<`ChatRequest`\>

Extra params merged into `client.chat`.

###### processResponse?

(`response`) => `TResponse` \| `Promise`\<`TResponse`\>

Transform or validate the response before returning it; rejected cached responses are removed.

###### schemaJson?

`unknown`

JSON schema for structured output.

###### systemPrompt?

`string`

Optional system prompt.

###### temperature?

`number`

Sampling temperature (default 0).

###### thinkingLevel?

`boolean` \| `"low"` \| `"medium"` \| `"high"`

Enables reasoning. Pass `true` for models that only support on/off, or `"low"`, `"medium"`, or `"high"` for granular control.

#### Returns

`Promise`\<\{ `contextWindow`: `number` \| `null`; `durationMs`: `number`; `files`: `object`[]; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `response`: `TResponse`; `systemPrompt`: `string` \| `null`; `temperature`: `number`; `thinkingLevel`: `boolean` \| `"low"` \| `"medium"` \| `"high"` \| `null`; `thoughts`: `string` \| `null`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; \}\>

#### Examples

```ts
// Assumes AI_MODEL is set in environment variables.
const result = await askOllama("What is the capital of France?");
console.log(result.response); // "Paris"
```

```ts
// Use a custom Ollama instance.
import { Ollama } from "ollama";
const client = new Ollama({ host: "http://127.0.0.1:11434" });
const result = await askOllama("What is the capital of France?", { ollama: client });
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
const schema = z.toJSONSchema(z.object({ country: z.string(), capital: z.string() }));
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

***

### getEmbedding()

> **getEmbedding**(`text`, `options?`): `Promise`\<`number`[]\>

Generates a numerical embedding (vector representation) for a given text string. Embeddings are crucial for various natural language processing (NLP) tasks, including semantic search, text classification, clustering, and anomaly detection, as they allow text to be processed and compared mathematically.

This function supports both Google's Gemini AI models and local models running with Ollama. It provides options for authentication, model selection, and caching to optimize performance and cost.

**Authentication**:
With no explicit provider, credentials, model information, and provider selection come from environment variables (`AI_KEY`, `AI_PROJECT`, `AI_LOCATION`, `AI_EMBEDDINGS_MODEL`, `AI_EMBEDDINGS_PROVIDER`). Providerless options intentionally contain only fields shared by every provider.

**Local Models**:
To use a local model with Ollama, pass `provider: "ollama"`, or set `AI_EMBEDDINGS_PROVIDER=ollama` (the legacy `OLLAMA` environment variable is also supported), and ensure Ollama is running. A custom `Ollama` client can be passed in the provider-specific `ollama` option.

**Caching**:
Responses are cached by default in a local `.journalism-cache` directory. If the same request is made again, the cached response will be returned, avoiding redundant API calls. Set `cache` to `false` to disable caching. Remember to add `.journalism-cache` to your `.gitignore` file.

**Options:**
- `provider`: Explicitly selects Gemini/Vertex or Ollama. When omitted, `AI_EMBEDDINGS_PROVIDER` is used, then the legacy `OLLAMA` fallback, then Gemini.
- `model`: The specific embedding model to use (e.g., 'text-embedding-004'). Defaults to the `AI_EMBEDDINGS_MODEL` environment variable.
- `apiKey`: Your Gemini API or Vertex Express Mode API key. Defaults to the `AI_KEY` environment variable.
- `vertex`: If `true`, explicitly selects the Vertex AI backend for the Google provider.
- `project`: Your Google Cloud project ID for Vertex AI. Defaults to the `AI_PROJECT` environment variable.
- `location`: The Google Cloud location for your Vertex AI project. Defaults to the `AI_LOCATION` environment variable.
- `cache`: If `true`, enables caching of the embedding response. Defaults to `true`.
- `ollama`: A custom Ollama client. Boolean selection remains supported at runtime for compatibility but is deprecated; use `provider: "ollama"` instead.
- `verbose`: If `true`, logs additional information such as execution time and the truncated input text. Defaults to `false`.
- `contextWindow`: An option to specify the context window size for Ollama models. By default, Ollama sets this depending on the model, which can be lower than the actual maximum context window size of the model.
- `beforeRequest`: Awaited immediately before each uncached provider dispatch, including when caching is disabled. Cache hits skip it. Throwing prevents dispatch and successful caching. Caller retries invoke it again; it is excluded from cache identity.

#### Parameters

##### text

`string`

The input text string for which to generate the embedding.

##### options?

\{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex?`: `false`; \} \| \{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `string`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `string`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex`: `true`; \} \| \{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `number`; `location?`: `undefined`; `model?`: `string`; `ollama?`: \{ `embeddingEndpoint?`: `string`; `embed`: `Promise`\<\{ `embeddings`: `number`[][]; \}\>; \}; `project?`: `undefined`; `provider`: `"ollama"`; `verbose?`: `boolean`; `vertex?`: `undefined`; \} \| \{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider?`: `undefined`; `verbose?`: `boolean`; `vertex?`: `undefined`; \}

Configuration options for the embedding generation.

###### Type Literal

\{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex?`: `false`; \}

Configuration options for the embedding generation.

###### apiKey?

`string`

Gemini API key. Defaults to `AI_KEY`.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`undefined`

Ollama context windows are not valid for the Gemini API.

###### location?

`undefined`

Vertex locations are not valid for the Gemini API.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

`undefined`

Ollama clients are not valid for the Gemini API.

###### project?

`undefined`

Vertex projects are not valid for the Gemini API.

###### provider

`"gemini"`

Explicitly selects the Google embedding provider.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex?

`false`

Keeps the request on the Gemini API rather than Vertex AI.

***

###### Type Literal

\{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `string`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `string`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex`: `true`; \}

Configuration options for the embedding generation.

###### apiKey?

`string`

Vertex Express Mode API key.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`undefined`

Ollama context windows are not valid for Vertex AI.

###### location?

`string`

Google Cloud location. Defaults to `AI_LOCATION`.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

`undefined`

Ollama clients are not valid for Vertex AI.

###### project?

`string`

Google Cloud project. Defaults to `AI_PROJECT`.

###### provider

`"gemini"`

Explicitly selects the Google embedding provider.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex

`true`

Selects the Vertex AI backend.

***

###### Type Literal

\{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `number`; `location?`: `undefined`; `model?`: `string`; `ollama?`: \{ `embeddingEndpoint?`: `string`; `embed`: `Promise`\<\{ `embeddings`: `number`[][]; \}\>; \}; `project?`: `undefined`; `provider`: `"ollama"`; `verbose?`: `boolean`; `vertex?`: `undefined`; \}

Configuration options for the embedding generation.

###### apiKey?

`undefined`

Gemini and Vertex API keys are not valid for Ollama.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`number`

The model context-window size sent to Ollama.

###### location?

`undefined`

Vertex locations are not valid for Ollama.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

\{ `embeddingEndpoint?`: `string`; `embed`: `Promise`\<\{ `embeddings`: `number`[][]; \}\>; \}

A custom Ollama client.

###### ollama.embeddingEndpoint?

`string`

Non-secret deployment endpoint for custom adapters that are not instances
of the Ollama SDK client.

###### ollama.embed

###### project?

`undefined`

Vertex projects are not valid for Ollama.

###### provider

`"ollama"`

Explicitly selects Ollama.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex?

`undefined`

Vertex selection is not valid for Ollama.

***

###### Type Literal

\{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider?`: `undefined`; `verbose?`: `boolean`; `vertex?`: `undefined`; \}

Configuration options for the embedding generation.

###### apiKey?

`undefined`

Direct credentials require an explicit provider.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`undefined`

Provider-specific semantic options require an explicit provider.

###### location?

`undefined`

Direct deployment selection requires an explicit provider.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

`undefined`

Custom clients require an explicit provider.

###### project?

`undefined`

Direct deployment selection requires an explicit provider.

###### provider?

`undefined`

Omit the discriminator to select the provider from the environment.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex?

`undefined`

Direct backend selection requires an explicit provider.

#### Returns

`Promise`\<`number`[]\>

A promise that resolves to an array of numbers representing the generated embedding.

#### Examples

```ts
// Environment-selected usage. Configure AI_EMBEDDINGS_PROVIDER,
// AI_EMBEDDINGS_MODEL, and the matching credentials first.
const embedding = await getEmbedding("The quick brown fox jumps over the lazy dog.");
console.log(embedding); // [0.012, -0.034, ..., 0.056] (example output)
```

```ts
// Embeddings are cached by default.
const cachedEmbedding = await getEmbedding("Artificial intelligence is transforming industries.");
console.log(cachedEmbedding);
```

```ts
// Generate an embedding using a specific model and API key.
const customEmbedding = await getEmbedding("Machine learning is a subset of AI.", {
  provider: "gemini",
  model: "another-embedding-model",
  apiKey: "your_custom_api_key"
});
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
const verboseEmbedding = await getEmbedding("The quick brown fox jumps over the lazy dog.", { verbose: true });
console.log(verboseEmbedding);
```

```ts
// Apply pacing only when the response is not cached.
const embedding = await getEmbedding("Local reporting matters.", {
  provider: "ollama",
  model: "nomic-embed-text",
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
});
```

***

### getEmbeddingIdentity()

> **getEmbeddingIdentity**(`options?`, `environment?`): \{ `backend`: `"gemini-api"`; `model`: `string`; `provider`: `"gemini"`; `schemaVersion`: `2`; \} \| \{ `backend`: `"vertex"`; `location?`: `string`; `model`: `string`; `project?`: `string`; `provider`: `"gemini"`; `schemaVersion`: `2`; \} \| \{ `backend`: `"ollama"`; `contextWindow?`: `number`; `endpoint`: `string`; `model`: `string`; `provider`: `"ollama"`; `schemaVersion`: `2`; \}

Returns the canonical, non-secret identity for an embedding request.
Downstream persisted data can compare this value to decide whether vectors
are compatible with the current request.

#### Parameters

##### options?

\{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex?`: `false`; \} \| \{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `string`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `string`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex`: `true`; \} \| \{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `number`; `location?`: `undefined`; `model?`: `string`; `ollama?`: \{ `embeddingEndpoint?`: `string`; `embed`: `Promise`\<\{ `embeddings`: `number`[][]; \}\>; \}; `project?`: `undefined`; `provider`: `"ollama"`; `verbose?`: `boolean`; `vertex?`: `undefined`; \} \| \{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider?`: `undefined`; `verbose?`: `boolean`; `vertex?`: `undefined`; \}

Provider-aware embedding options.

###### Type Literal

\{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex?`: `false`; \}

Provider-aware embedding options.

###### apiKey?

`string`

Gemini API key. Defaults to `AI_KEY`.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`undefined`

Ollama context windows are not valid for the Gemini API.

###### location?

`undefined`

Vertex locations are not valid for the Gemini API.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

`undefined`

Ollama clients are not valid for the Gemini API.

###### project?

`undefined`

Vertex projects are not valid for the Gemini API.

###### provider

`"gemini"`

Explicitly selects the Google embedding provider.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex?

`false`

Keeps the request on the Gemini API rather than Vertex AI.

***

###### Type Literal

\{ `apiKey?`: `string`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `string`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `string`; `provider`: `"gemini"`; `verbose?`: `boolean`; `vertex`: `true`; \}

Provider-aware embedding options.

###### apiKey?

`string`

Vertex Express Mode API key.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`undefined`

Ollama context windows are not valid for Vertex AI.

###### location?

`string`

Google Cloud location. Defaults to `AI_LOCATION`.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

`undefined`

Ollama clients are not valid for Vertex AI.

###### project?

`string`

Google Cloud project. Defaults to `AI_PROJECT`.

###### provider

`"gemini"`

Explicitly selects the Google embedding provider.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex

`true`

Selects the Vertex AI backend.

***

###### Type Literal

\{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `number`; `location?`: `undefined`; `model?`: `string`; `ollama?`: \{ `embeddingEndpoint?`: `string`; `embed`: `Promise`\<\{ `embeddings`: `number`[][]; \}\>; \}; `project?`: `undefined`; `provider`: `"ollama"`; `verbose?`: `boolean`; `vertex?`: `undefined`; \}

Provider-aware embedding options.

###### apiKey?

`undefined`

Gemini and Vertex API keys are not valid for Ollama.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`number`

The model context-window size sent to Ollama.

###### location?

`undefined`

Vertex locations are not valid for Ollama.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

\{ `embeddingEndpoint?`: `string`; `embed`: `Promise`\<\{ `embeddings`: `number`[][]; \}\>; \}

A custom Ollama client.

###### ollama.embeddingEndpoint?

`string`

Non-secret deployment endpoint for custom adapters that are not instances
of the Ollama SDK client.

###### ollama.embed

###### project?

`undefined`

Vertex projects are not valid for Ollama.

###### provider

`"ollama"`

Explicitly selects Ollama.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex?

`undefined`

Vertex selection is not valid for Ollama.

***

###### Type Literal

\{ `apiKey?`: `undefined`; `beforeRequest?`: () => `void` \| `Promise`\<`void`\>; `cache?`: `boolean`; `contextWindow?`: `undefined`; `location?`: `undefined`; `model?`: `string`; `ollama?`: `undefined`; `project?`: `undefined`; `provider?`: `undefined`; `verbose?`: `boolean`; `vertex?`: `undefined`; \}

Provider-aware embedding options.

###### apiKey?

`undefined`

Direct credentials require an explicit provider.

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Awaits caller-controlled pacing immediately before an uncached provider
request. Cache hits skip this hook. Throwing prevents dispatch and caching.
The hook is excluded from embedding identity and cache keys.

**Example**

```ts
const options = {
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
```

###### cache?

`boolean`

Whether to persist and reuse the embedding response. Defaults to `true`.

###### contextWindow?

`undefined`

Provider-specific semantic options require an explicit provider.

###### location?

`undefined`

Direct deployment selection requires an explicit provider.

###### model?

`string`

The embedding model. Defaults to `AI_EMBEDDINGS_MODEL`.

###### ollama?

`undefined`

Custom clients require an explicit provider.

###### project?

`undefined`

Direct deployment selection requires an explicit provider.

###### provider?

`undefined`

Omit the discriminator to select the provider from the environment.

###### verbose?

`boolean`

Whether to log request and timing information.

###### vertex?

`undefined`

Direct backend selection requires an explicit provider.

##### environment?

Environment used to resolve omitted values.

#### Returns

The canonical identity used by embedding caches.

##### Type Literal

\{ `backend`: `"gemini-api"`; `model`: `string`; `provider`: `"gemini"`; `schemaVersion`: `2`; \}

###### backend

> **backend**: `"gemini-api"`

Resolved Gemini API backend.

###### model

> **model**: `string`

Resolved embedding model.

###### provider

> **provider**: `"gemini"`

Resolved provider.

###### schemaVersion

> **schemaVersion**: `2`

Cache-compatibility schema for the canonical identity.

***

##### Type Literal

\{ `backend`: `"vertex"`; `location?`: `string`; `model`: `string`; `project?`: `string`; `provider`: `"gemini"`; `schemaVersion`: `2`; \}

###### backend

> **backend**: `"vertex"`

Resolved Vertex AI backend.

###### location?

> `optional` **location?**: `string`

Resolved Google Cloud location, when configured.

###### model

> **model**: `string`

Resolved embedding model.

###### project?

> `optional` **project?**: `string`

Resolved Google Cloud project, when configured.

###### provider

> **provider**: `"gemini"`

Resolved provider.

###### schemaVersion

> **schemaVersion**: `2`

Cache-compatibility schema for the canonical identity.

***

##### Type Literal

\{ `backend`: `"ollama"`; `contextWindow?`: `number`; `endpoint`: `string`; `model`: `string`; `provider`: `"ollama"`; `schemaVersion`: `2`; \}

###### backend

> **backend**: `"ollama"`

Resolved Ollama backend.

###### contextWindow?

> `optional` **contextWindow?**: `number`

Context-window size when explicitly configured.

###### endpoint

> **endpoint**: `string`

Non-secret Ollama endpoint identity.

###### model

> **model**: `string`

Resolved embedding model.

###### provider

> **provider**: `"ollama"`

Resolved provider.

###### schemaVersion

> **schemaVersion**: `2`

Cache-compatibility schema for the canonical identity.

#### Example

```ts
const identity = getEmbeddingIdentity({
  provider: "ollama",
  model: "nomic-embed-text",
  contextWindow: 8192,
});
```
