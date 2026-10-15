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

Requires **Node.js 24.21.0 or later**.

```sh
npm install @nshiab/journalism-ai
```

```ts
import { askGemini } from "@nshiab/journalism-ai";

// Set AI_KEY and AI_MODEL in your environment first.
const result = await askGemini("What is the capital of France?");
console.log(result.response);
```

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
