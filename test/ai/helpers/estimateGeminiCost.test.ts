import "@std/dotenv/load";
import { assert, assertEquals } from "jsr:@std/assert";
import askGemini from "../../../src/ai/askGemini.ts";

const credentials = Deno.env.get("AI_KEY") ?? Deno.env.get("AI_PROJECT");
if (credentials) {
  Deno.test("Gemini reports candidate and thought tokens separately", async () => {
    const result = await askGemini(
      "Solve 27 * 43 step by step, then return the result.",
      {
        model: "gemini-3.5-flash",
        thinkingLevel: "high",
      },
    );

    assert(result.thoughtsTokenCount > 0);
    assertEquals(
      result.totalTokens,
      result.promptTokenCount + result.outputTokenCount +
        result.thoughtsTokenCount,
    );
    assertEquals(
      result.estimatedCost,
      (result.promptTokenCount / 1_000_000) * 1.50 +
        ((result.outputTokenCount + result.thoughtsTokenCount) / 1_000_000) *
          9.00,
    );
  });
}
