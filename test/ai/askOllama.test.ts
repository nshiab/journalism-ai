import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import askOllama from "../../src/ai/askOllama.ts";
import { existsSync, rmSync } from "node:fs";
import { Ollama } from "ollama";
import * as z from "zod";

const ollamaEnv = Deno.env.get("OLLAMA");
console.log("OLLAMA", ollamaEnv);
if (ollamaEnv) {
  if (existsSync("./.journalism-cache")) {
    rmSync("./.journalism-cache", { recursive: true });
  }
  Deno.test("should use a simple prompt", async () => {
    const result = await askOllama("What is the capital of France?");
    console.log(result);
    assertEquals(result.thinkingLevel, null);
    assertEquals(result.contextWindow, null);
    assertEquals(result.temperature, 0);
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a high temperature", async () => {
    const result = await askOllama("What is the capital of France?", {
      temperature: 1,
    });
    console.log(result);
    assertEquals(result.temperature, 1);
    assertEquals(result.contextWindow, null);
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a context window", async () => {
    const result = await askOllama("What is the capital of France?", {
      contextWindow: 4096,
    });
    console.log(result);
    assertEquals(result.contextWindow, 4096);
    assertEquals(result.temperature, 0);
    assertEquals(true, true);
  });
  Deno.test(
    "should use a simple prompt with thinking",
    {
      sanitizeResources: false,
    },
    async () => {
      const result = await askOllama("What is the capital of France?", {
        thinkingLevel: true,
      });
      console.log(result);
      assertEquals(result.thinkingLevel, true);
      assertEquals(true, true);
    },
  );
  Deno.test(
    "should use a simple prompt and returning JSON",
    {
      sanitizeResources: false,
    },
    async () => {
      const schema = z.toJSONSchema(
        z.object({ country: z.string(), capital: z.string() }),
      );
      const result = await askOllama(
        "What is the capital of France? Return JSON.",
        { schemaJson: schema },
      );
      console.log(result);
      assertEquals(true, true);
    },
  );
  Deno.test(
    "should use a simple prompt with a different Ollama instance",
    { sanitizeResources: false },
    async () => {
      const ollamaClient = new Ollama({ host: "http://127.0.0.1:11434" });
      const result = await askOllama("What is the capital of France?", {
        ollama: ollamaClient,
      });
      console.log(result);
      assertEquals(true, true);
    },
  );
  Deno.test("should use a simple prompt with cache and schema", async () => {
    const schema = z.toJSONSchema(z.array(z.string()));
    const result = await askOllama(
      "Give me a list of 3 countries in Europe. Return JSON.",
      {
        schemaJson: schema,
        cache: true,
      },
    );
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return cached schema data", async () => {
    const schema = z.toJSONSchema(z.array(z.string()));
    const result = await askOllama(
      "Give me a list of 3 countries in Europe. Return JSON.",
      {
        schemaJson: schema,
        cache: true,
      },
    );
    console.log(result);
    assertEquals(result.fromCache, true);
  });
  Deno.test("should use a simple prompt with cache", async () => {
    const result = await askOllama("What is the capital of France?", {
      cache: true,
    });
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return cached data", async () => {
    const result = await askOllama("What is the capital of France?", {
      cache: true,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });
  Deno.test("should cache and return structured output", {
    sanitizeResources: false,
  }, async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );
    const result = await askOllama("Give me 10 random people. Return JSON.", {
      cache: true,
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return cached structured output", {
    sanitizeResources: false,
  }, async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );
    const result = await askOllama("Give me 10 random people. Return JSON.", {
      cache: true,
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });

  Deno.test(
    "should analyze images",
    { sanitizeResources: false },
    async () => {
      const schema = z.toJSONSchema(
        z.object({
          name: z.string().nullable(),
          description: z.string(),
          isPolitician: z.boolean(),
        }),
      );
      const result = await askOllama(
        "Return an object with: name (person if recognizable, else null), description, isPolitician. Return JSON.",
        {
          files: [{
            path:
              "test/data/ai/pictures/Screenshot 2025-03-21 at 1.36.47 PM.png",
            type: "image" as const,
          }],
          schemaJson: schema,
        },
      );
      console.log(result);
      assertEquals(true, true);
    },
  );
  Deno.test("should use a text file", async () => {
    const result = await askOllama(
      "What is the content of this text file?",
      { files: [{ path: "test/data/data.csv", type: "text" as const }] },
    );
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return a structured output and cache it", {
    sanitizeResources: false,
  }, async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );

    const result = await askOllama("Give me 10 random people. Return JSON.", {
      cache: true,
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return a cached structured output", {
    sanitizeResources: false,
  }, async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );

    const result = await askOllama("Give me 10 random people. Return JSON.", {
      cache: true,
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });
  Deno.test("should work without a system prompt", async () => {
    const result = await askOllama("Why is the sky blue?", {
      thinkingLevel: "low",
    });
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should work with a system prompt", async () => {
    const result = await askOllama("Why is the sky blue?", {
      systemPrompt: "Always answer with rhymes.",
      thinkingLevel: "low",
    });
    console.log(result);
    assertEquals(result.systemPrompt, "Always answer with rhymes.");
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level low", {
    sanitizeResources: false,
  }, async () => {
    const result = await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      { thinkingLevel: "low" },
    );
    console.log(result);
    assertEquals(result.thinkingLevel, "low");
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level medium", {
    sanitizeResources: false,
  }, async () => {
    const result = await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      { thinkingLevel: "medium" },
    );
    console.log(result);
    assertEquals(result.thinkingLevel, "medium");
    assertEquals(true, true);
  });
  Deno.test(
    "should not use cached response when thinking level changes",
    {
      sanitizeResources: false,
    },
    async () => {
      const withoutThinking = await askOllama(
        "Find 12 * 13. Return just the number.",
        { cache: true },
      );
      const withThinking = await askOllama(
        "Find 12 * 13. Return just the number.",
        { thinkingLevel: "medium", cache: true },
      );
      console.log({ withoutThinking, withThinking });
      assertEquals(withoutThinking.thinkingLevel, null);
      assertEquals(withThinking.thinkingLevel, "medium");
      assertEquals(withThinking.fromCache, false);
    },
  );
  Deno.test("should work with thinking level high", {
    sanitizeResources: false,
  }, async () => {
    const result = await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      { thinkingLevel: "high" },
    );
    console.log(result);
    assertEquals(result.thinkingLevel, "high");
    assertEquals(true, true);
  });
} else {
  console.log("No OLLAMA in process.env");
}
