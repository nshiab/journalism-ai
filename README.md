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

```ts
import { askAI } from "@nshiab/journalism-ai";

// Set OPENAI_API_KEY and AI_MODEL in your environment first.
const result = await askAI("What is the capital of France?", {
  provider: "openai",
});
console.log(result.response);
```

## AI providers

`askAI(prompt, options)` uses a shared generation, validation and caching pipeline.
Select a provider explicitly or set `AI_PROVIDER`:

| `provider`  | Credentials                                                                                        | Model environment variable |
| ----------- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| `openai`    | `OPENAI_API_KEY`                                                                                   | `OPENAI_MODEL`             |
| `anthropic` | `ANTHROPIC_API_KEY`                                                                                | `ANTHROPIC_MODEL`          |
| `gemini`    | `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`, or legacy `AI_KEY`                               | `GEMINI_MODEL`             |
| `vertex`    | Google Application Default Credentials with `AI_PROJECT`/`AI_LOCATION`, or `GOOGLE_VERTEX_API_KEY` | `VERTEX_MODEL`             |
| `ollama`    | Local Ollama; optional `OLLAMA_HOST`                                                               | `OLLAMA_MODEL`             |

All providers also accept an explicit `model`, falling back to `AI_MODEL` after
the provider-specific environment variable. Vertex is Google's Gemini Enterprise
Agent Platform backend; `provider: "gemini", vertex: true` also selects it.
Explicit selection takes precedence over `AI_PROVIDER`. If neither is set,
legacy Google project or Ollama configuration is used, otherwise Gemini.
Provider credentials are kept separate: OpenAI and Anthropic do not reuse
Google's `AI_KEY`. Built-in cloud adapters connect directly to the providers;
no Vercel account or AI Gateway is required.

```ts
import { askAI } from "@nshiab/journalism-ai";
import { z } from "zod";

// Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL first.
const result = await askAI("List three European countries.", {
  provider: "anthropic",
  schemaJson: z.toJSONSchema(z.array(z.string())),
  processResponse: (value) => z.array(z.string()).parse(value),
});
console.log(result.response.join(", "));
```

Responses are cached by default in `.journalism-cache`. Add that directory to your
`.gitignore`. Cache identity separates providers, deployments, models, settings
and local file contents. `processResponse` reruns on cache hits, and its output
is never cached. Set `cache: false` to disable caching. Sampling is left to the
model unless `temperature` is supplied; retries default to zero and can be enabled
with `maxRetries`. Responses include token usage, timing, reasoning when available,
provider warnings and web-search sources. Estimated cost is currently `null`.

Use `files: [{ path, type }]` for text, images and PDFs when supported by the model.
Audio/video inputs require Gemini or Vertex; `gs://` URLs require Vertex. Use
`mediaType` when a local file's extension does not identify its media type. For
mutable GCS objects, disable caching or change `cacheKey` when the object changes.
Provider-specific controls go in namespaced `providerOptions`. For example,
`providerOptions: { ollama: { contextWindow: 8192, thinkingLevel: "low" } }`.

For additional providers, install their compatible Vercel AI SDK adapter and pass
its model object as `model`, without `provider`. Configure credentials on that
adapter. Model objects must implement the v4 language-model specification used by
AI SDK 7. Provide a non-secret deployment/configuration `cacheKey`, or disable caching, so
different deployments cannot share responses accidentally. See the `askAI`
reference for an example.

The existing `askGemini`, `askGeminiPool`, `askOllama`, and embedding functions
retain their current interfaces. They continue to use their native SDKs for
compatibility, including native parameter passthrough. This additive integration
retains the old Google SDK; the smaller fully migrated dependency configuration
in the research notes requires a separate compatibility migration. Simple Data
Analysis also needs an integration update before its own provider options can
select the new cloud providers.

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
