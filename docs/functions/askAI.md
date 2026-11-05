[**Journalism AI v3.0.7**](../index.md)

***

[Journalism AI](../globals.md) / askAI

# Function: askAI()

> **askAI**\<`TResponse`\>(`prompt`, `options?`): `Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `finishReason`: `string`; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `provider`: `string`; `response`: `TResponse`; `sources`: `object`[]; `systemPrompt`: `string` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `warnings`: `object`[]; \}\>

Defined in: askAI.ts:112

Generates text or validated structured data through one shared provider interface.

Select `openai`, `anthropic`, `gemini`, `vertex` (Gemini Enterprise Agent
Platform), or `ollama`. Omit `provider` to use `AI_PROVIDER`, falling back to
Gemini or the legacy Google project/Ollama environment configuration. Vertex
can also be selected with `provider: "gemini", vertex: true`.

Alternatively, pass an AI SDK model adapter implementing the v4 specification
(used by AI SDK 7) as `model`. Configure
its credentials and deployment on that adapter. Supply a non-secret `cacheKey`
identifying its deployment and model settings when caching is enabled. No Vercel account or
gateway is required for the built-in providers.

Original, validated responses are cached in `.journalism-cache` by default.
`processResponse` runs on every call, including cache hits, and its output is
never cached. Schema and processing failures do not create successful entries;
rejected cached entries are removed. Credentials and callbacks are excluded
from cache identity. Local attachment contents are included.

Structured output uses an internal object envelope so arrays and primitive
schemas also have an object root on the wire. The envelope is removed before
local validation, processing, caching and return. Provider schema restrictions
still apply. Refusals and incomplete responses reject rather than being cached.

Sampling defaults are left to the model. Transport retries default to zero;
`maxRetries` opts in to AI SDK retries. Application validation is not retried.
`beforeRequest` runs before each adapter dispatch, including transport retries,
and skips cache hits. Throwing prevents that dispatch.

Images and text work with all built-in providers when the model supports them.
PDFs work with the cloud providers; audio/video require Gemini or Vertex.
`gs://` inputs require Vertex. Local media types are inferred from extensions;
use `mediaType` for other extensions. `providerOptions` forwards namespaced AI
SDK settings. Ollama accepts `contextWindow`, `thinkingLevel`, and `keepAlive`
in `providerOptions.ollama`. Unsupported settings are returned as warnings.
Estimated cost is currently unknown (`null`).
For mutable GCS inputs, disable caching or change `cacheKey` when the object changes.

## Type Parameters

### TResponse

`TResponse` = `unknown`

## Parameters

### prompt

`string`

The primary text prompt.

### options?

Provider selection, model configuration and response processing.

#### abortSignal?

`AbortSignal`

Cancels model generation.

#### apiKey?

`string`

Explicit provider credential. Environment defaults are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`/`GEMINI_API_KEY`/`AI_KEY`, or `GOOGLE_VERTEX_API_KEY`.

#### baseURL?

`string`

Custom non-secret provider endpoint. Ollama also reads `OLLAMA_HOST`.

#### beforeRequest?

() => `void` \| `Promise`\<`void`\>

Called immediately before each uncached adapter dispatch.

#### cache?

`boolean`

Enable response caching; defaults to `true`.

#### cacheKey?

`string`

Non-secret deployment/configuration identity required for cached custom adapters; also usable to version remote attachments.

#### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Custom transport for built-in adapters; configure custom adapters directly instead.

#### files?

`object`[]

Ordered local attachments or Vertex GCS URLs.

#### location?

`string`

Vertex location; defaults to `AI_LOCATION`, `GOOGLE_VERTEX_LOCATION`, then `global`.

#### maxOutputTokens?

`number`

Optional output-token limit.

#### maxRetries?

`number`

Transport/API retry count; defaults to zero.

#### model?

`string` \| \{ `doGenerate`: (`options`) => `PromiseLike`\<`LanguageModelV4GenerateResult`\>; `doStream`: (`options`) => `PromiseLike`\<`LanguageModelV4StreamResult`\>; `modelId`: `string`; `provider`: `string`; `specificationVersion`: `"v4"`; `supportedUrls`: `Record`\<`string`, `RegExp`[]\> \| `PromiseLike`\<`Record`\<`string`, `RegExp`[]\>\>; \}

Model name (defaults to the provider's `*_MODEL`, then `AI_MODEL`) or an AI SDK model adapter implementing the v4 specification.

#### processResponse?

(`response`) => `TResponse` \| `Promise`\<`TResponse`\>

Synchronous or asynchronous validation/transformation, rerun on cache hits.

#### project?

`string`

Vertex project; defaults to `AI_PROJECT` or `GOOGLE_VERTEX_PROJECT`.

#### provider?

`"ollama"` \| `"openai"` \| `"anthropic"` \| `"gemini"` \| `"vertex"`

Explicit provider; otherwise use `AI_PROVIDER` or legacy defaults.

#### providerOptions?

\{\[`provider`: `string`\]: `object`; \}

Namespaced AI SDK provider settings, excluding credentials.

#### reasoning?

`"minimal"` \| `"low"` \| `"medium"` \| `"high"` \| `"provider-default"` \| `"none"` \| `"xhigh"` \| `"max"`

Shared AI SDK reasoning setting, subject to model support.

#### schemaJson?

`unknown`

JSON Schema for structured output and local validation.

#### systemPrompt?

`string`

Optional system instruction.

#### temperature?

`number`

Optional sampling temperature; no forced default.

#### vertex?

`boolean`

Compatibility selector for the Vertex backend of Gemini.

#### webSearch?

`boolean`

Enable provider-native web search; unsupported for Ollama and custom adapters.

## Returns

`Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `finishReason`: `string`; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `provider`: `string`; `response`: `TResponse`; `sources`: `object`[]; `systemPrompt`: `string` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `warnings`: `object`[]; \}\>

The response with provider, cache, usage, reasoning, timing and warning metadata.

## Examples

```ts
import { askAI } from "@nshiab/journalism-ai";
// Configure OPENAI_API_KEY and AI_MODEL first.
const result = await askAI("What is the capital of France?", { provider: "openai" });
console.log(result.response);
```

```ts
import { askAI } from "@nshiab/journalism-ai";
import { z } from "zod";
// Configure ANTHROPIC_API_KEY and AI_MODEL first.
const result = await askAI("List three countries.", {
  provider: "anthropic",
  schemaJson: z.toJSONSchema(z.array(z.string())),
  processResponse: (value) => z.array(z.string()).parse(value),
});
console.log(result.response.join(", "));
```

```ts
import { askAI } from "@nshiab/journalism-ai";
import { createOpenAI } from "@ai-sdk/openai";
// Configure OPENAI_API_KEY first; use a model available to your account.
const model = process.env.OPENAI_MODEL;
if (!model) throw new Error("Set OPENAI_MODEL first.");
const provider = createOpenAI();
const result = await askAI("Summarize this article.", {
  model: provider.responses(model),
  cacheKey: "my-openai-deployment",
  files: [{ path: "article.txt", type: "text" }],
});
console.log(result.response);
```
