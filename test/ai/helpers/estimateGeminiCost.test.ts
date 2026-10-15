import estimateGeminiCost from "../../../src/ai/helpers/estimateGeminiCost.ts";
import { test, describe } from "vite-plus/test";
import { ok as assert, deepStrictEqual as assertEquals } from "node:assert/strict";
import askGemini from "../../../src/ai/askGemini.ts";

const credentials = process.env.AI_KEY || (process.env.AI_PROJECT && process.env.AI_LOCATION);
describe.skipIf(process.env.CI === "true" || !credentials)("live Gemini accounting", () => {
  test("Gemini reports candidate and thought tokens separately", async () => {
    const result = await askGemini("Solve 27 * 43 step by step, then return the result.", {
      model: "gemini-3.5-flash",
      thinkingLevel: "high",
    });

    assert(result.thoughtsTokenCount > 0);
    assertEquals(
      result.totalTokens,
      result.promptTokenCount + result.outputTokenCount + result.thoughtsTokenCount,
    );
    assertEquals(
      result.estimatedCost,
      (result.promptTokenCount / 1_000_000) * 1.5 +
        ((result.outputTokenCount + result.thoughtsTokenCount) / 1_000_000) * 9.0,
    );
  });
});

test("estimates known model tiers, audio input, reasoning output, and unknown models", () => {
  assertEquals(estimateGeminiCost("gemini-3.5-flash", 1000000, 1000000, 1000000, false), 19.5);
  assertEquals(estimateGeminiCost("gemini-3.1-pro", 200000, 1000000, 0, false), 12.4);
  assertEquals(estimateGeminiCost("gemini-3.1-pro", 200001, 1000000, 0, false), 18.800004);
  assertEquals(estimateGeminiCost("gemini-3-flash-preview", 1000000, 1000000, 0, true), 4);
  assertEquals(estimateGeminiCost("unknown", 1, 2, 3, false), null);
});
