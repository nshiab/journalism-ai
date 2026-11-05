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
