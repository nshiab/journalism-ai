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

import askAI from "./ai/askAI.ts";
import askAIPool from "./ai/askAIPool.ts";
import askGemini from "./ai/askGemini.ts";
import askOllama from "./ai/askOllama.ts";
import getEmbedding from "./ai/getEmbedding.ts";

export { askAI, askAIPool, askGemini, askOllama, getEmbedding };
export type { askAIRequest } from "./ai/askAIPool.ts";
export type { GeminiDetailedResponse } from "./ai/askGemini.ts";
export type { OllamaDetailedResponse } from "./ai/askOllama.ts";
