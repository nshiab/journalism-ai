[**Journalism AI v3.0.7**](../index.md)

***

[Journalism AI](../globals.md) / askAI

# Function: askAI()

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

## Type Parameters

### TResponse

`TResponse` = `unknown`

## Parameters

### prompt

`string`

The primary text prompt.

### options?

Model, files, caching and response processing. A custom AI SDK
v4 model adapter can be passed as `model`; configure its credentials directly
and provide a non-secret deployment/configuration `cacheKey`, or disable cache.

#### abortSignal?

`AbortSignal`

#### apiKey?

`string`

#### baseURL?

`string`

#### beforeRequest?

() => `void` \| `Promise`\<`void`\>

#### cache?

`boolean`

#### cacheKey?

`string`

#### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### files?

`object`[]

#### location?

`string`

#### maxOutputTokens?

`number`

#### maxRetries?

`number`

#### model?

`string` \| \{ `doGenerate`: (`options`) => `PromiseLike`\<`LanguageModelV4GenerateResult`\>; `doStream`: (`options`) => `PromiseLike`\<`LanguageModelV4StreamResult`\>; `modelId`: `string`; `provider`: `string`; `specificationVersion`: `"v4"`; `supportedUrls`: `Record`\<`string`, `RegExp`[]\> \| `PromiseLike`\<`Record`\<`string`, `RegExp`[]\>\>; \}

#### processResponse?

(`response`) => `TResponse` \| `Promise`\<`TResponse`\>

#### project?

`string`

#### providerOptions?

\{\[`provider`: `string`\]: `object`; \}

#### reasoning?

`"none"` \| `"high"` \| `"low"` \| `"medium"` \| `"provider-default"` \| `"minimal"` \| `"xhigh"` \| `"max"`

#### schemaJson?

`unknown`

#### systemPrompt?

`string`

#### temperature?

`number`

#### webSearch?

`boolean`

## Returns

`Promise`\<\{ `durationMs`: `number`; `estimatedCost`: `number` \| `null`; `finishReason`: `string`; `fromCache`: `boolean`; `model`: `string`; `outputTokenCount`: `number`; `prompt`: `string`; `promptTokenCount`: `number`; `provider`: `string`; `response`: `TResponse`; `sources`: `object`[]; `systemPrompt`: `string` \| `null`; `thoughts`: `string` \| `null`; `thoughtsTokenCount`: `number`; `tokensPerSecond`: `number` \| `null`; `totalTokens`: `number`; `warnings`: `object`[]; \}\>

The response with provider, cache, usage, reasoning, timing, warnings
and web-search sources. Output-token counts include reasoning tokens.

## Examples

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
