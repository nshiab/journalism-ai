[**Journalism AI v3.0.7**](../index.md)

***

[Journalism AI](../globals.md) / askAIPool

# Function: askAIPool()

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

## Type Parameters

### TResponse

`TResponse` = `unknown`

## Parameters

### requests

`object`[]

Prompts with optional IDs and `askAI` options.

### poolSize

`number`

Maximum concurrent requests; a positive integer.

### options?

Progress logging, retries and per-worker pacing.

#### logProgress?

`boolean`

#### minRequestDurationMs?

`number`

#### retry?

`number`

#### retryCheck?

(`error`) => `boolean` \| `Promise`\<`boolean`\>

## Returns

`Promise`\<\{ `errors`: `object`[]; `results`: `object`[]; \}\>

Successful responses and terminal errors, each sorted by original index.

## Examples

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
