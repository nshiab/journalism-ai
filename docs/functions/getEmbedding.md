[**Journalism AI v3.0.7**](../index.md)

***

[Journalism AI](../globals.md) / getEmbedding

# Function: getEmbedding()

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

## Parameters

### text

`string`

The text to embed.

### options?

Provider, model, cache and request settings. `dimensions` is
available for supporting cloud models; `contextWindow` is Ollama-only.
`providerOptions` forwards non-secret AI SDK settings such as Google's task type.

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

#### contextWindow?

`number`

#### dimensions?

`number`

#### fetch?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### location?

`string`

#### maxRetries?

`number`

#### model?

`string`

#### project?

`string`

#### provider?

`"openai"` \| `"gemini"` \| `"google-agent-platform"` \| `"ollama"`

#### providerOptions?

\{\[`provider`: `string`\]: `object`; \}

#### verbose?

`boolean`

## Returns

`Promise`\<`number`[]\>

A non-empty vector of finite numbers.

## Examples

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
