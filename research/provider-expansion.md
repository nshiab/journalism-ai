# Adding OpenAI and Anthropic

Evaluated November 4, 2026 against local version 3.0.7, commit
`93323b0da350a5982d5f93ad132755dd2982e5d7`, GitHub issues and pull requests,
and first-party documentation. This is a research proposal, not an implementation.

Follow-up: [measured SDK size comparison](./provider-size-comparison.md). The
official SDKs remain the smallest architectural change, but the measured Vercel
configuration is smaller on disk and offers a promising shared cloud-provider
layer. Use that follow-up when evaluating footprint and downstream maintenance.

## Existing issues and architecture

The GitHub CLI returned all 23 issues, open and closed, and all 21 pull requests.
None requests OpenAI or Anthropic support. Related work:

- [PR #33](https://github.com/nshiab/journalism-ai/pull/33) deliberately split
  generation into provider-specific functions.
- [Issue #35](https://github.com/nshiab/journalism-ai/issues/35), closed, established
  provider-aware embedding options and cache identity.
- [Issue #31](https://github.com/nshiab/journalism-ai/issues/31), closed, concerns
  Google's SDK naming update.
- [Issue #5](https://github.com/nshiab/journalism-ai/issues/5), open, requests more
  Ollama file types, rather than more providers.

Issue absence is a snapshot of the
[issue tracker](https://github.com/nshiab/journalism-ai/issues?q=is%3Aissue),
not a guarantee about future requests.

The current public exports are `askGemini`, `askGeminiPool`, `askOllama`,
`getEmbedding`, and `getEmbeddingIdentity` ([entry point](../src/index.ts)).
Generation already shares cache and response-processing helpers, while each
provider handles its own authentication, request format and metrics.
`askGeminiPool` remains Gemini-specific and owns application-level retries.
Embedding resolution already distinguishes provider, backend, model, deployment
and semantic options ([implementation](../src/ai/embeddingOptions.ts)). Runtime
dependencies are currently `@google/genai`, `ollama`, and `zod`.

Google's current platform name is **Gemini Enterprise Agent Platform**, shortened
to Agent Platform. The installed Google SDK accepts `enterprise` and the older
`vertexai` flag; this library currently uses `vertexai` internally and exposes
`vertex`. Preserve that public option and existing embedding identities when
adding unrelated providers. See Google's
[official name mapping](https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes)
and the installed `GoogleGenAIOptions` declaration in
`node_modules/@google/genai/dist/node/node.d.ts`.

## Implementation options

These are implementation strategies; a unified public function is a separate API
design choice that could sit over any of them.

| Option                                   | What changes                                                                   | Advantages                                                                                       | Costs and limitations                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official SDKs — recommended              | Add `openai` and `@anthropic-ai/sdk`; implement `askOpenAI` and `askAnthropic` | Fits the existing architecture; direct provider features; additive API                           | Maintain request/response mappings and tests for each provider                                                                                                              |
| Vercel AI SDK                            | Add `ai` with OpenAI and Anthropic adapters                                    | Common generation, structured output, streaming and usage APIs; easier future provider additions | Adds another abstraction; adopting it for existing Gemini/Ollama behavior requires a separate migration                                                                     |
| OpenAI-compatible endpoints or a gateway | Route several vendors through an OpenAI-shaped protocol                        | Less protocol-specific code; convenient access to additional endpoints                           | Compatibility is partial; a hosted gateway adds a service, configuration and its own operational considerations                                                             |
| Direct REST using `fetch`                | Implement native HTTP requests without provider SDKs                           | Avoid SDK dependencies                                                                           | Locally maintain request types, error handling, retries and API changes; conflicts with the preference for existing standard tools unless dependency constraints justify it |

Official SDK references:
[OpenAI TypeScript](https://developers.openai.com/api/reference/typescript),
[Anthropic TypeScript](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript).
AI SDK references:
[OpenAI adapter](https://ai-sdk.dev/providers/ai-sdk-providers/openai),
[Anthropic adapter](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic),
[structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).
The table's fit and maintenance assessments are architectural judgments based on
this repository, not vendor claims.

Vercel hosting or AI Gateway is not required when using explicit direct provider
objects with vendor credentials. Its Ollama integration is listed among
[community providers](https://ai-sdk.dev/providers/community-providers/ollama),
which matters if replacing the existing official Ollama client.

Anthropic's [OpenAI compatibility layer](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)
currently accepts strict JSON Schema structured output in Chat Completions, but
ignores options including `reasoning_effort`, `store`, `audio`, and `modalities`;
PDF/file and input-audio content blocks are unsupported. It should not be treated
as native Anthropic feature parity. This also differs from OpenAI's Responses
API, recommended for new OpenAI integrations.

## Recommended scope and behavior

Start with additive `askOpenAI(prompt, options = {})` and
`askAnthropic(prompt, options = {})`, using OpenAI Responses and Anthropic
Messages respectively. Keep their implementation and tests in matching
`src/ai/` and `test/ai/` files, and export the functions through `src/index.ts`.
Use inline object-shaped public parameter types under the current AGENTS.md
rules. Preserve existing signatures and provider behavior.

The first increment should support text, model selection, API keys, system
instructions, `schemaJson`, `processResponse`, caching, and token/timing metadata.
Prefer explicit `model` and `apiKey`, with provider-specific environment defaults
such as `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`; avoid accidentally reusing a
Google `AI_KEY` or a Gemini/Ollama `AI_MODEL` for another service. Decide and
document new model-environment names before implementation. No specific model
default is recommended by this research.

Important design details:

1. **Structured output:** OpenAI Responses uses `text.format`; Anthropic uses
   `output_config.format`. Both support native JSON Schema output with limits.
   OpenAI requires an object root, so the current Gemini examples with top-level
   arrays need adaptation, such as `{ items: [...] }`. Validate the original
   requested schema locally on fresh responses and cache hits; reject unsupported
   constraints clearly. Do not silently weaken the user's schema. Sources:
   [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
   [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
2. **Completion handling:** distinguish successful text/JSON from refusals,
   incomplete responses and output-token truncation before processing or cache
   writes. Native structured output does not remove these cases. See the same
   structured-output guides and
   [Responses migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses).
3. **Caching:** reuse the current original-response/processing-callback contract.
   Include provider, non-secret backend/deployment identity, model, actual merged
   request options, and attachment content in cache identity. Exclude credentials
   and callbacks. Hashing must describe the final effective request, including
   provider-specific overrides; otherwise overrides can produce incorrect hits.
   This is a proposed requirement, based on the current
   [cache helper](../src/ai/helpers/cache.ts) and generation implementations.
4. **Retries and pools:** both official SDKs default to two transport/API retries;
   AI SDK generation also defaults to two. Define one total-attempt policy before
   combining SDK retries with a pool. For example, two pool retries over two SDK
   retries can yield nine HTTP attempts. Response-validation retries are a
   separate application concern. A shared internal executor could later serve
   provider-specific pools, but the existing `askGeminiPool` cannot directly run
   the new providers. Sources: official SDK references above and
   [AI SDK generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text).
5. **Provider controls:** expose reasoning, search, sampling and output limits
   only where supported; do not assume a universal `temperature: 0`, thinking
   vocabulary, or Google safety switch. Keep provider-specific options accurately
   typed. Return usage/timing consistently while documenting provider differences;
   leave estimated costs unknown until their calculation is implemented.

## Files, embeddings and cloud access

Text files, images and PDFs make a useful next increment for document-analysis
workflows. Both providers document image and PDF inputs, subject to model and
request limits. Validate supported media types and actual MIME types explicitly;
do not promise the current Gemini audio/video or `gs://` behavior. Sources:
[OpenAI images](https://developers.openai.com/api/docs/guides/images-vision),
[OpenAI files](https://developers.openai.com/api/docs/guides/file-inputs),
[Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision),
[Claude PDFs](https://platform.claude.com/docs/en/build-with-claude/pdf-support).

OpenAI embeddings fit a separate extension to `getEmbedding` with explicit
`provider: "openai"`. Extend resolution, option validation, canonical identity,
cache separation and tests together. Include `dimensions` and any other
vector-affecting parameters in identity. Changing embedding models requires
re-embedding existing datasets; equal vector lengths do not establish compatible
vector spaces. See [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)
and the repository's [identity implementation](../src/ai/embeddingOptions.ts).

Anthropic explicitly has no native embedding model. Its documentation discusses
Voyage, a separate provider; adding Anthropic generation must not imply native
Anthropic embeddings. See [Anthropic embeddings](https://platform.claude.com/docs/en/build-with-claude/embeddings).

For users who need Google Cloud credentials/billing, Claude also has a distinct
Google-managed backend and an `@anthropic-ai/vertex-sdk` integration. This is
additional work: passing a Claude model ID into the current Gemini implementation
does not add support. Consider it after direct Anthropic support, based on demand.
See [Claude on Google Cloud](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed)
and the Anthropic TypeScript SDK reference above.

## Delivery and validation

Suggested sequence:

1. Add the two native text/structured-output wrappers and their focused tests.
2. Add image/PDF inputs, then provider-native reasoning/search if needed.
3. Extend OpenAI embeddings in a separate change.
4. Add a shared public `ask`/pool facade only if simpler provider switching becomes
   a concrete user requirement. Keep provider-specific functions available.

Use mocked provider boundaries for request mapping, usage, refusals/truncation,
schema failures, callback reruns, cache isolation, changed file contents, override
handling and retry counts. Keep live tests credential-gated and skipped in CI.
For embeddings, include compile-time option-boundary tests and cache identity
tests with different providers/models/dimensions. Follow the normal formatting,
full-check and generated-documentation workflow when implementing.

No provider implementation, dependency additions, GitHub issues or pull requests
were created as part of this evaluation.
