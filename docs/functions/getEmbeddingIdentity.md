[**Journalism AI v3.0.7**](../index.md)

***

[Journalism AI](../globals.md) / getEmbeddingIdentity

# Function: getEmbeddingIdentity()

> **getEmbeddingIdentity**(`options?`, `environment?`): `object`

Defined in: getEmbeddingIdentity.ts:26

Returns the non-secret identity that determines embedding compatibility.

Uses the same provider, deployment, model and semantic settings as
`getEmbedding`. Credentials, cache controls, logging and callbacks are excluded.
Compare this identity before reusing persisted vectors; changing models or
dimensions requires re-embedding the data. Older identity versions are incompatible.

## Parameters

### options?

The same configuration used for the embedding request.

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

### environment?

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

Environment defaults; uses `process.env` when omitted.

## Returns

`object`

The canonical identity used for embedding caches and persisted data.

### authentication

> **authentication**: `"api-key"` \| `"adc"` \| `"none"`

### contextWindow?

> `optional` **contextWindow?**: `number`

### dimensions?

> `optional` **dimensions?**: `number`

### endpoint

> **endpoint**: `string`

### location?

> `optional` **location?**: `string`

### model

> **model**: `string`

### project?

> `optional` **project?**: `string`

### provider

> **provider**: `"openai"` \| `"gemini"` \| `"google-agent-platform"` \| `"ollama"`

### providerOptions

> **providerOptions**: `object`

#### Index Signature

\[`provider`: `string`\]: `object`

### schemaVersion

> **schemaVersion**: `3`

## Example

```ts
import { getEmbeddingIdentity } from "@nshiab/journalism-ai";
const identity = getEmbeddingIdentity({
  provider: "ollama", model: "nomic-embed-text", contextWindow: 8192,
});
console.log(identity);
```
