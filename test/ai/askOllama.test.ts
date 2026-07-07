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
  Deno.test("should use a simple prompt (ollama)", async () => {
    const result = await askOllama("What is the capital of France?");
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a high temperature (ollama)", async () => {
    const result = await askOllama("What is the capital of France?", {
      temperature: 1,
    });
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test(
    "should use a simple prompt with thinking (ollama)",
    {
      sanitizeResources: false,
    },
    async () => {
      const result = await askOllama("What is the capital of France?", {
        thinkingLevel: true,
      });
      console.log(result);
      assertEquals(true, true);
    },
  );
  Deno.test(
    "should use a simple prompt with thinking and returning JSON (ollama)",
    {
      sanitizeResources: false,
    },
    async () => {
      const schema = z.toJSONSchema(
        z.object({ country: z.string(), capital: z.string() }),
      );
      const result = await askOllama(
        "What is the capital of France?",
        { thinkingLevel: true, schemaJson: schema },
      );
      console.log(result);
      assertEquals(true, true);
    },
  );
  Deno.test(
    "should use a simple prompt with a different Ollama instance (ollama)",
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
  Deno.test("should use a simple prompt with cache and schema (ollama)", async () => {
    const schema = z.toJSONSchema(z.array(z.string()));
    await askOllama("Give me a list of 3 countries in Europe.", {
      schemaJson: schema,
      cache: true,
    });
    assertEquals(true, true);
  });
  Deno.test("should return cached schema data (ollama)", async () => {
    const schema = z.toJSONSchema(z.array(z.string()));
    const result = await askOllama("Give me a list of 3 countries in Europe.", {
      schemaJson: schema,
      cache: true,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });
  Deno.test("should use a simple prompt with cache (ollama)", async () => {
    const result = await askOllama("What is the capital of France?", {
      cache: true,
    });
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return cached data (ollama)", async () => {
    const result = await askOllama("What is the capital of France?", {
      cache: true,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });
  Deno.test("should cache and return structured output (ollama)", {
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
    await askOllama("Give me 10 random people.", {
      cache: true,
      schemaJson: schema,
    });
    assertEquals(true, true);
  });
  Deno.test("should return cached structured output (ollama)", {
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
    const result = await askOllama("Give me 10 random people.", {
      cache: true,
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });

  Deno.test(
    "should analyze images (ollama)",
    { sanitizeResources: false },
    async () => {
      const schema = z.toJSONSchema(
        z.object({
          name: z.string().nullable(),
          description: z.string(),
          isPolitician: z.boolean(),
        }),
      );
      await askOllama(
        "Return an object with: name (person if recognizable, else null), description, isPolitician.",
        {
          files: [{
            path:
              "test/data/ai/pictures/Screenshot 2025-03-21 at 1.36.47 PM.png",
            type: "image" as const,
          }],
          schemaJson: schema,
        },
      );
      assertEquals(true, true);
    },
  );
  Deno.test("should use a text file (ollama)", async () => {
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

    await askOllama("Give me 10 random people.", {
      cache: true,
      schemaJson: schema,
    });
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

    const result = await askOllama("Give me 10 random people.", {
      cache: true,
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });
  Deno.test("should work without a system prompt", async () => {
    await askOllama("Why is the sky blue?");
    assertEquals(true, true);
  });
  Deno.test("should work with a system prompt", async () => {
    await askOllama("Why is the sky blue?", {
      systemPrompt: "Always answer with rhymes.",
    });
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level low (ollama)", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      { thinkingLevel: "low" },
    );
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level medium (ollama)", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      { thinkingLevel: "medium" },
    );
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level high (ollama)", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      { thinkingLevel: "high" },
    );
    assertEquals(true, true);
  });
} else {
  console.log("No OLLAMA in process.env");
}
