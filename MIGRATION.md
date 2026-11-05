# Migrating to v4

Generation now uses `askAI` and `askAIPool`, with one interface for every provider.
Embeddings remain available through `getEmbedding` and `getEmbeddingIdentity`.

## Configuration

Set `AI_PROVIDER`, `AI_MODEL` and `AI_KEY`. Choose `openai`, `anthropic`, `gemini`,
`google-agent-platform`, or `ollama`. There is no automatic provider detection or
fallback to another vendor. Ollama ignores the key; Google Agent Platform also
accepts application credentials with `AI_PROJECT` and optional `AI_LOCATION`.

`AI_KEY` is the only built-in API-key variable. Provider-specific key/model
variables and the legacy `OLLAMA` flag are no longer read. Explicit `apiKey` and
`model` options override the corresponding environment values.

## Function and option changes

| Before                                     | v4                                                            |
| ------------------------------------------ | ------------------------------------------------------------- |
| `askGemini(prompt)`                        | `askAI(prompt)` with `AI_PROVIDER=gemini`                     |
| `askGemini(prompt, { vertex: true })`      | `askAI(prompt)` with `AI_PROVIDER=google-agent-platform`      |
| `askOllama(prompt)`                        | `askAI(prompt)` with `AI_PROVIDER=ollama`                     |
| `askGeminiPool(requests, size)`            | `askAIPool(requests, size)`                                   |
| Pool request's top-level `processResponse` | `request.options.processResponse`                             |
| `thinkingLevel` / `thinkingBudget`         | `reasoning` or model-specific `providerOptions`               |
| `geminiParameters` / `ollamaParameters`    | Shared options and namespaced Vercel AI SDK `providerOptions` |
| Custom Ollama client                       | `baseURL` and optional `fetch`                                |

For example, an Ollama context window becomes
`providerOptions: { ollama: { contextWindow: 8192 } }`. Ollama also accepts
`thinkingLevel` and `keepAlive` in that namespace. Native SDK passthrough and
`safetyEnabled` are removed; configure supported model settings through
`providerOptions` instead.

```ts
import { askAI, askAIPool } from "@nshiab/journalism-ai";

const result = await askAI("Summarize this article.", { cache: false });
const batch = await askAIPool([{ prompt: "What is the capital of France?" }], 5);
console.log(result.response, batch.results);
```

## Responses and retries

`response`, cache flags and the common usage/timing fields remain available.
`outputTokenCount` now includes reasoning tokens; `thoughtsTokenCount` is a subset.
Use `totalTokens` for totals. Known Gemini API costs are estimated; other costs
are `null`.

Sampling and reasoning use the model's defaults. Set `temperature` or `reasoning`
explicitly when you need different behavior.

`processResponse` still runs on fresh and cached values. Structured responses are
validated locally, and invalid/incomplete responses are not cached. Generation
uses a new cache namespace, so old entries are ignored.

Direct calls have no retries unless `maxRetries` is set. Pools use their own
`retry` and `retryCheck` controls, with transport retries disabled to avoid
multiplying attempts.

## Embeddings and downstream libraries

Set `AI_EMBEDDINGS_MODEL`. The provider comes from `AI_EMBEDDINGS_PROVIDER`, then
`AI_PROVIDER`, or an explicit embedding `provider` option. Use
`google-agent-platform` instead of `provider: "gemini", vertex: true`.
`OLLAMA` and custom native clients are no longer selectors.

Embedding identity is now version 3. Older cached vectors are ignored. Compare
`getEmbeddingIdentity` before reusing persisted vectors; rebuild incompatible
embedding columns or indexes. Model-specific options and requested dimensions
are part of identity.

Simple Data Analysis must update its generation routing, pool calls and
embedding configuration before adopting this major version.
