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
import getEmbedding from "./ai/getEmbedding.ts";

export { askAI, askAIPool, getEmbedding };
export type { askAIRequest } from "./ai/askAIPool.ts";
