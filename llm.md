**Journalism AI v3.0.7**

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

```sh
npm install @nshiab/journalism-ai
```

Configure your environment:

```sh
AI_PROVIDER=gemini
AI_KEY=your-key
AI_MODEL=your-model
```

```ts
import { askAI } from "@nshiab/journalism-ai";

const result = await askAI("What is the capital of France?");
console.log(result.response);
```

`AI_PROVIDER` is required. Choose `openai`, `anthropic`, `gemini`,
`google-agent-platform`, or `ollama`. All cloud API keys use `AI_KEY`; Ollama
ignores it and connects locally (or to `OLLAMA_HOST`). Google Agent Platform,
formerly Vertex AI, also supports application credentials with `AI_PROJECT` and
optional `AI_LOCATION`. Built-in adapters connect directly to the providers;
no Vercel account or gateway is required.

## Structured output and files

```ts
import { askAI } from "@nshiab/journalism-ai";
import { z } from "zod";

const result = await askAI("List the people mentioned in this article.", {
  files: [{ path: "article.txt", type: "text" }],
  schemaJson: z.toJSONSchema(z.array(z.string())),
  processResponse: (value) => z.array(z.string()).parse(value),
});
console.log(result.response.join(", "));
```

Text and images work with supporting models; cloud models also accept PDFs.
Audio/video require Google, and `gs://` URLs require Google Agent Platform.
Responses include token usage, timing, reasoning when available, warnings and
web-search sources. Use `webSearch: true` for provider-native search.

Responses are cached in `.journalism-cache` by default; add it to `.gitignore`.
`processResponse` runs on every call, including cache hits, and its output is
never cached. Use `cache: false` to disable caching. Retries default to zero.

## Concurrent requests

```ts
import { askAIPool } from "@nshiab/journalism-ai";

const { results, errors } = await askAIPool(
  [
    { id: "france", prompt: "What is the capital of France?" },
    { id: "germany", prompt: "What is the capital of Germany?" },
  ],
  5,
  { retry: 2 },
);

for (const entry of results) console.log(entry.request.id, entry.result.response);
console.log(`${errors.length} failed`);
```

Each request accepts `options` like `askAI`. The pool handles concurrency,
retries and optional pacing through `minRequestDurationMs`. Results and errors
are returned in input order.

## Embeddings

```ts
import { getEmbedding } from "@nshiab/journalism-ai";

// Set AI_EMBEDDINGS_MODEL first.
const vector = await getEmbedding("Local reporting matters.");
console.log(vector.length);
```

Embeddings use `AI_PROVIDER`, or `AI_EMBEDDINGS_PROVIDER` when a different service
is needed. OpenAI, Gemini, Google Agent Platform and Ollama are supported;
Anthropic has no native embedding model. Vectors are cached by provider, model
and settings. `getEmbeddingIdentity` identifies compatible persisted vectors.

See the [v4 migration guide](https://github.com/nshiab/journalism-ai/blob/main/MIGRATION.md)
for changes from the provider-specific functions.

## Starting a data project

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

### askAI()

> **askAI**\<`TResponse`\>(`prompt`, `options?`): `Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `finishReason`: `string`; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `provider`: `string`; `response`: `TResponse`; `sources`: `object`[]; `systemPrompt`: `string` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `warnings`: `object`[]; \}\>

Defined in: [askAI.ts:64](https://github.com/nshiab/journalism-ai/blob/v3.0.7/src/ai/askAI.ts#L64)

Asks an AI model for text or validated structured data.

Set `AI_PROVIDER`, `AI_MODEL` and `AI_KEY`. Providers are `openai`,
`anthropic`, `gemini`, `google-agent-platform` and `ollama`. Ollama ignores
`AI_KEY`; Google Agent Platform also supports application credentials with
`AI_PROJECT` and optional `AI_LOCATION` (default `global`). Explicit model and credential options
override their environment values. Provider selection is never inferred from keys.

Original responses are cached in `.journalism-cache` by default. Add that
directory to `.gitignore`, or set `cache: false`. `processResponse` runs on
every call, including cache hits, and its output is never cached.

Pass a JSON Schema through `schemaJson` for locally validated output. Arrays
and primitives are supported through an internal object envelope. Failed,
refused or incomplete responses are not cached. Local file contents are part
of cache identity; version mutable GCS objects with `cacheKey` or disable cache.

Images/text work with supported models; cloud models also accept PDFs.
Audio/video require Google; `gs://` URLs require Google Agent Platform.
Sampling is left to the model. `maxRetries` defaults to zero; each uncached
dispatch awaits `beforeRequest`. Model-specific settings use `providerOptions`.
Known Gemini API costs are estimated; other model costs are `null`.

#### Type Parameters

##### TResponse

`TResponse` = `unknown`

#### Parameters

##### prompt

`string`

The primary text prompt.

##### options?

Model, files, caching and response processing. A custom AI SDK
v4 model adapter can be passed as `model`; configure its credentials directly
and provide a non-secret deployment/configuration `cacheKey`, or disable cache.

###### abortSignal?

`AbortSignal`

###### apiKey?

`string`

###### baseURL?

`string`

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

###### cache?

`boolean`

###### cacheKey?

`string`

###### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

###### files?

`object`[]

###### location?

`string`

###### maxOutputTokens?

`number`

###### maxRetries?

`number`

###### model?

`string` \| \{ `doGenerate`: (`options`) => `PromiseLike`\<`LanguageModelV4GenerateResult`\>; `doStream`: (`options`) => `PromiseLike`\<`LanguageModelV4StreamResult`\>; `modelId`: `string`; `provider`: `string`; `specificationVersion`: `"v4"`; `supportedUrls`: `Record`\<`string`, `RegExp`[]\> \| `PromiseLike`\<`Record`\<`string`, `RegExp`[]\>\>; \}

###### processResponse?

(`response`) => `TResponse` \| `Promise`\<`TResponse`\>

###### project?

`string`

###### providerOptions?

\{\[`provider`: `string`\]: `object`; \}

###### reasoning?

`"none"` \| `"high"` \| `"low"` \| `"medium"` \| `"provider-default"` \| `"minimal"` \| `"xhigh"` \| `"max"`

###### schemaJson?

`unknown`

###### systemPrompt?

`string`

###### temperature?

`number`

###### webSearch?

`boolean`

#### Returns

`Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `finishReason`: `string`; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `provider`: `string`; `response`: `TResponse`; `sources`: `object`[]; `systemPrompt`: `string` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `warnings`: `object`[]; \}\>

The response with provider, cache, usage, reasoning, timing, warnings
and web-search sources. Output-token counts include reasoning tokens.

#### Examples

```ts
import { askAI } from "@nshiab/journalism-ai";
// Set AI_PROVIDER=openai, AI_KEY and AI_MODEL first.
const result = await askAI("What is the capital of France?");
console.log(result.response);
```

```ts
import { askAI } from "@nshiab/journalism-ai";
import { z } from "zod";
const result = await askAI("List three countries.", {
  schemaJson: z.toJSONSchema(z.array(z.string())),
  processResponse: (value) => z.array(z.string()).parse(value),
});
console.log(result.response.join(", "));
```

```ts
import { askAI } from "@nshiab/journalism-ai";
const result = await askAI("Describe this image.", {
  files: [{ path: "photo.png", type: "image" }],
});
console.log(result.response);
```

***

### askAIPool()

> **askAIPool**\<`TResponse`\>(`requests`, `poolSize`, `options?`): `Promise`\<\{ `errors`: `object`[]; `results`: `object`[]; \}\>

Defined in: askAIPool.ts:51

Processes AI requests concurrently with one pool for every provider.

Uses the same environment configuration, files, caching and response processing
as `askAI`. Results and terminal errors retain each request's index and optional
ID, and are returned in input order.

`retry` is the number of additional attempts (default zero). It covers provider
and response-processing failures; transport retries are disabled inside the
pool. `retryCheck` can restrict retries. `minRequestDurationMs` sets a minimum
duration for each worker attempt, including failures. Cache hits skip the
request's `beforeRequest` hook. Configuration is captured before workers start.

#### Type Parameters

##### TResponse

`TResponse` = `unknown`

#### Parameters

##### requests

`object`[]

Prompts with optional IDs and `askAI` options.

##### poolSize

`number`

Maximum concurrent requests; a positive integer.

##### options?

Progress logging, retries and per-worker pacing.

###### logProgress?

`boolean`

###### minRequestDurationMs?

`number`

###### retry?

`number`

###### retryCheck?

(`error`) => `boolean` \| `Promise`\<`boolean`\>

#### Returns

`Promise`\<\{ `errors`: `object`[]; `results`: `object`[]; \}\>

Successful responses and terminal errors, each sorted by original index.

#### Examples

```ts
import { askAIPool } from "@nshiab/journalism-ai";
// Configure AI_PROVIDER, AI_MODEL and the matching credentials first.
const { results, errors } = await askAIPool([
  { id: "france", prompt: "What is the capital of France?" },
  { id: "germany", prompt: "What is the capital of Germany?" },
], 5, { retry: 2 });
for (const entry of results) console.log(entry.request.id, entry.result.response);
console.log(`${errors.length} failed`);
```

```ts
import { askAIPool } from "@nshiab/journalism-ai";
import { z } from "zod";
const { results } = await askAIPool([
  { prompt: "List three European countries.", options: {
    schemaJson: z.toJSONSchema(z.array(z.string())),
    processResponse: (value) => z.array(z.string()).parse(value),
  } },
], 2, { minRequestDurationMs: 1000 });
console.log(results[0]?.result.response.join(", "));
```

***

### getEmbedding()

> **getEmbedding**(`text`, `options?`): `Promise`\<`number`[]\>

Defined in: [getEmbedding.ts:48](https://github.com/nshiab/journalism-ai/blob/v3.0.7/src/ai/getEmbedding.ts#L48)

Generates a numerical embedding for text, useful for semantic search and clustering.

Supports OpenAI, Gemini, Google Agent Platform and Ollama. Set
`AI_EMBEDDINGS_MODEL` and `AI_PROVIDER`; `AI_EMBEDDINGS_PROVIDER` can select a
different provider for embeddings. Cloud API keys use `AI_KEY`. Google Agent
Platform also accepts application credentials with `AI_PROJECT`/`AI_LOCATION`.
Ollama ignores `AI_KEY`. Anthropic does not provide native embeddings.

Vectors are cached in `.journalism-cache` by default. Identity separates
providers, deployments, models, dimensions and model-specific settings.
`beforeRequest` runs only before uncached dispatches, including retries.
`maxRetries` defaults to zero. Cache entries from older identities are ignored.

#### Parameters

##### text

`string`

The text to embed.

##### options?

Provider, model, cache and request settings. `dimensions` is
available for supporting cloud models; `contextWindow` is Ollama-only.
`providerOptions` forwards non-secret AI SDK settings such as Google's task type.

###### abortSignal?

`AbortSignal`

###### apiKey?

`string`

###### baseURL?

`string`

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

###### cache?

`boolean`

###### contextWindow?

`number`

###### dimensions?

`number`

###### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

###### location?

`string`

###### maxRetries?

`number`

###### model?

`string`

###### project?

`string`

###### provider?

`"openai"` \| `"gemini"` \| `"google-agent-platform"` \| `"ollama"`

###### providerOptions?

\{\[`provider`: `string`\]: `object`; \}

###### verbose?

`boolean`

#### Returns

`Promise`\<`number`[]\>

A non-empty vector of finite numbers.

#### Examples

```ts
import { getEmbedding } from "@nshiab/journalism-ai";
// Configure AI_PROVIDER, AI_KEY and AI_EMBEDDINGS_MODEL first.
const vector = await getEmbedding("Local reporting matters.");
console.log(vector.length);
```

```ts
import { getEmbedding } from "@nshiab/journalism-ai";
const vector = await getEmbedding("Local reporting matters.", {
  provider: "ollama", model: "nomic-embed-text", contextWindow: 8192,
  beforeRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
});
console.log(vector);
```

***

### getEmbeddingIdentity()

> **getEmbeddingIdentity**(`options?`, `environment?`): `object`

Defined in: getEmbeddingIdentity.ts:26

Returns the non-secret identity that determines embedding compatibility.

Uses the same provider, deployment, model and semantic settings as
`getEmbedding`. Credentials, cache controls, logging and callbacks are excluded.
Compare this identity before reusing persisted vectors; changing models or
dimensions requires re-embedding the data. Older identity versions are incompatible.

#### Parameters

##### options?

The same configuration used for the embedding request.

###### abortSignal?

`AbortSignal`

###### apiKey?

`string`

###### baseURL?

`string`

###### beforeRequest?

() => `void` \| `Promise`\<`void`\>

###### cache?

`boolean`

###### contextWindow?

`number`

###### dimensions?

`number`

###### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

###### location?

`string`

###### maxRetries?

`number`

###### model?

`string`

###### project?

`string`

###### provider?

`"openai"` \| `"gemini"` \| `"google-agent-platform"` \| `"ollama"`

###### providerOptions?

\{\[`provider`: `string`\]: `object`; \}

###### verbose?

`boolean`

##### environment?

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

Environment defaults; uses `process.env` when omitted.

#### Returns

`object`

The canonical identity used for embedding caches and persisted data.

##### authentication

> **authentication**: `"api-key"` \| `"adc"` \| `"none"`

##### contextWindow?

> `optional` **contextWindow?**: `number`

##### dimensions?

> `optional` **dimensions?**: `number`

##### endpoint

> **endpoint**: `string`

##### location?

> `optional` **location?**: `string`

##### model

> **model**: `string`

##### project?

> `optional` **project?**: `string`

##### provider

> **provider**: `"openai"` \| `"gemini"` \| `"google-agent-platform"` \| `"ollama"`

##### providerOptions

> **providerOptions**: `object`

###### Index Signature

\[`provider`: `string`\]: `object`

##### schemaVersion

> **schemaVersion**: `3`

#### Example

```ts
import { getEmbeddingIdentity } from "@nshiab/journalism-ai";
const identity = getEmbeddingIdentity({
  provider: "ollama", model: "nomic-embed-text", contextWindow: 8192,
});
console.log(identity);
```
