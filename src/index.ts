/**
 * @module
 *
 * The Journalism library (AI functions)
 *
 * To install the library with Deno, use:
 * ```bash
 * deno add jsr:@nshiab/journalism-ai
 * ```
 *
 * To install the library with Node.js, use:
 * ```bash
 * npm i @nshiab/journalism-ai
 * ```
 *
 * To import a function, use:
 * ```ts
 * import { functionName } from "@nshiab/journalism-ai";
 * ```
 */

import askGemini from "./ai/askGemini.ts";
import askGeminiPool from "./ai/askGeminiPool.ts";
import askOllama from "./ai/askOllama.ts";
import getEmbedding from "./ai/getEmbedding.ts";

export { askGemini, askGeminiPool, askOllama, getEmbedding };
export type {
  AskGeminiOptions,
  GeminiDetailedResponse,
  GeminiFile,
} from "./ai/askGemini.ts";
export type {
  AskGeminiPoolOptions,
  AskGeminiPoolRequest,
  AskGeminiPoolResult,
} from "./ai/askGeminiPool.ts";
export type {
  AskOllamaOptions,
  OllamaDetailedResponse,
} from "./ai/askOllama.ts";
export type { EmbeddingProvider } from "./ai/helpers/resolveEmbeddingProvider.ts";
