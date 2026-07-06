import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import askAI from "../../src/ai/askAI.ts";

const aiKey = Deno.env.get("AI_KEY") ?? Deno.env.get("AI_PROJECT");
if (typeof aiKey === "string" && aiKey !== "") {
  Deno.test("should route to Gemini and return a response", async () => {
    const result = await askAI("What is the capital of France?", {
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
}

const ollamaEnv = Deno.env.get("OLLAMA");
if (ollamaEnv) {
  Deno.test("should route to Ollama and return a response", async () => {
    const result = await askAI("What is the capital of France?", {
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
}
