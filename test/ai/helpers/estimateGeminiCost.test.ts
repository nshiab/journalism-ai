import estimateGeminiCost from "../../../src/ai/helpers/estimateGeminiCost.ts";
import { test } from "vite-plus/test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";

test("estimates known model tiers, audio input, reasoning output, and unknown models", () => {
  assertEquals(estimateGeminiCost("gemini-3.5-flash", 1000000, 1000000, 1000000, false), 19.5);
  assertEquals(estimateGeminiCost("gemini-3.1-pro", 200000, 1000000, 0, false), 12.4);
  assertEquals(estimateGeminiCost("gemini-3.1-pro", 200001, 1000000, 0, false), 18.800004);
  assertEquals(estimateGeminiCost("gemini-3-flash-preview", 1000000, 1000000, 0, true), 4);
  assertEquals(estimateGeminiCost("unknown", 1, 2, 3, false), null);
});
