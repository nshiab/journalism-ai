import { test, describe } from "vite-plus/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepStrictEqual as assertEquals, rejects as assertRejects } from "node:assert/strict";
import askOllama from "../../src/ai/askOllama.ts";
import { existsSync, rmSync } from "node:fs";
import { Ollama } from "ollama";
import * as z from "zod";
import { initCache, writeCache } from "../../src/ai/helpers/cache.ts";

function createFakeOllama(content: string, onChat?: (parameters: unknown) => void): Ollama {
  const client = new Ollama();
  Object.defineProperty(client, "chat", {
    value: (parameters: unknown) => {
      onChat?.(parameters);
      return Promise.resolve({
        message: { role: "assistant", content },
        prompt_eval_count: 0,
        eval_count: 0,
      });
    },
  });
  return client;
}

function inTemporaryDirectory(run: () => Promise<void>): Promise<void> {
  const originalDirectory = process.cwd();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "journalism-ai-"));
  process.chdir(temporaryDirectory);

  return run().finally(() => {
    process.chdir(originalDirectory);
    rmSync(temporaryDirectory, { recursive: true });
  });
}

test("caches Ollama responses by default and supports opting out", async () => {
  await inTemporaryDirectory(async () => {
    let requests = 0;
    const client = createFakeOllama("response", () => requests++);

    const first = await askOllama("default cache", {
      model: "test-model",
      ollama: client,
    });
    const second = await askOllama("default cache", {
      model: "test-model",
      ollama: client,
    });
    const uncachedFirst = await askOllama("disabled cache", {
      model: "test-model",
      ollama: client,
      cache: false,
    });
    const uncachedSecond = await askOllama("disabled cache", {
      model: "test-model",
      ollama: client,
      cache: false,
    });

    assertEquals(first.fromCache, false);
    assertEquals(second.fromCache, true);
    assertEquals(second.response, first.response);
    assertEquals(uncachedFirst.fromCache, false);
    assertEquals(uncachedSecond.fromCache, false);
    assertEquals(requests, 3);
  });
});

test("grounds Ollama structured responses with the JSON schema", async () => {
  const schema = z.toJSONSchema(z.array(z.object({ country: z.string(), population: z.string() })));
  let request: unknown;
  const client = createFakeOllama(
    '[{"country":"Morocco","population":"1,000,000"}]',
    (parameters) => (request = parameters),
  );

  await askOllama("Describe Marrakech.", {
    model: "test-only-model",
    ollama: client,
    schemaJson: schema,
    cache: false,
  });

  const { messages } = z
    .object({ messages: z.array(z.object({ content: z.string() })) })
    .parse(request);
  assertEquals(messages[0].content.includes(JSON.stringify(schema)), true);
});

test("rejects Ollama responses that do not match the JSON schema", async () => {
  const schema = z.toJSONSchema(z.array(z.object({ country: z.string(), population: z.string() })));
  const client = createFakeOllama('[{"country":"Morocco","population":1000000}]');

  await assertRejects(() =>
    askOllama("Describe Marrakech.", {
      model: "test-only-model",
      ollama: client,
      schemaJson: schema,
      cache: false,
    }),
  );
});

test("processes cached Ollama responses without a live server", async () => {
  const originalDirectory = process.cwd();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "journalism-ai-"));
  process.chdir(temporaryDirectory);
  const prompt = "deterministic cached response processor test";
  const model = "test-only-model";
  const { cacheFile } = initCache({
    model,
    messages: [{ role: "user", content: prompt }],
    format: undefined,
    temperature: 0,
    contextWindow: undefined,
    think: undefined,
  });
  writeCache(cacheFile, {
    response: "cached response",
    fromCache: false,
    prompt,
    model,
    systemPrompt: null,
    thinkingLevel: null,
    contextWindow: null,
    temperature: 0,
    files: [],
    promptTokenCount: 0,
    outputTokenCount: 0,
    totalTokens: 0,
    tokensPerSecond: 0,
    durationMs: 0,
    thoughts: null,
  });

  try {
    const result = await askOllama<string>(prompt, {
      model,
      cache: true,
      processResponse: (response) => String(response).toUpperCase(),
    });
    assertEquals(result.response, "CACHED RESPONSE");
    assertEquals(result.fromCache, true);
  } finally {
    process.chdir(originalDirectory);
    rmSync(temporaryDirectory, { recursive: true });
  }
});

const ollamaEnv = process.env.OLLAMA;

describe.skipIf(process.env.CI === "true" || !ollamaEnv || !process.env.AI_MODEL)(
  "live Ollama",
  () => {
    if (existsSync("./.journalism-cache")) {
      rmSync("./.journalism-cache", { recursive: true });
    }
    test("should use a simple prompt", async () => {
      const result = await askOllama("What is the capital of France?");
      console.log(result);
      assertEquals(result.thinkingLevel, null);
      assertEquals(result.contextWindow, null);
      assertEquals(result.temperature, 0);
      assertEquals(true, true);
    });
    test("should use a simple prompt with a high temperature", async () => {
      const result = await askOllama("What is the capital of France?", {
        temperature: 1,
      });
      console.log(result);
      assertEquals(result.temperature, 1);
      assertEquals(result.contextWindow, null);
      assertEquals(true, true);
    });
    test("should use a simple prompt with a context window", async () => {
      const result = await askOllama("What is the capital of France?", {
        contextWindow: 4096,
      });
      console.log(result);
      assertEquals(result.contextWindow, 4096);
      assertEquals(result.temperature, 0);
      assertEquals(true, true);
    });
    test("should use a simple prompt with thinking", async () => {
      const result = await askOllama("What is the capital of France?", {
        thinkingLevel: true,
      });
      console.log(result);
      assertEquals(result.thinkingLevel, true);
      assertEquals(true, true);
    });
    test("should use a simple prompt and returning JSON", async () => {
      const schema = z.toJSONSchema(z.object({ country: z.string(), capital: z.string() }));
      const result = await askOllama("What is the capital of France? Return JSON.", {
        schemaJson: schema,
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should use a simple prompt with a different Ollama instance", async () => {
      const ollamaClient = new Ollama({ host: "http://127.0.0.1:11434" });
      const result = await askOllama("What is the capital of France?", {
        ollama: ollamaClient,
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should use a simple prompt with cache and schema", async () => {
      const schema = z.toJSONSchema(z.array(z.string()));
      const result = await askOllama("Give me a list of 3 countries in Europe. Return JSON.", {
        schemaJson: schema,
        cache: true,
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should return cached schema data", async () => {
      const schema = z.toJSONSchema(z.array(z.string()));
      const result = await askOllama("Give me a list of 3 countries in Europe. Return JSON.", {
        schemaJson: schema,
        cache: true,
      });
      console.log(result);
      assertEquals(result.fromCache, true);
    });
    test("should use a simple prompt with cache", async () => {
      const result = await askOllama("What is the capital of France?", {
        cache: true,
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should return cached data", async () => {
      const result = await askOllama("What is the capital of France?", {
        cache: true,
      });
      console.log(result);
      assertEquals(result.fromCache, true);
    });
    test("should cache and return structured output", async () => {
      const schema = z.toJSONSchema(
        z.object({
          people: z.array(
            z.object({
              name: z.string(),
              age: z.number(),
              gender: z.enum(["man", "woman"]),
            }),
          ),
        }),
      );
      const result = await askOllama("Give me 10 random people. Return JSON.", {
        cache: true,
        schemaJson: schema,
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should return cached structured output", async () => {
      const schema = z.toJSONSchema(
        z.object({
          people: z.array(
            z.object({
              name: z.string(),
              age: z.number(),
              gender: z.enum(["man", "woman"]),
            }),
          ),
        }),
      );
      const result = await askOllama("Give me 10 random people. Return JSON.", {
        cache: true,
        schemaJson: schema,
      });
      console.log(result);
      assertEquals(result.fromCache, true);
    });

    test("should analyze images", async () => {
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
          files: [
            {
              path: "test/data/ai/pictures/Screenshot 2025-03-21 at 1.36.47 PM.png",
              type: "image",
            },
          ],
          schemaJson: schema,
        },
      );
      console.log(result);
      assertEquals(true, true);
    });
    test("should use a text file", async () => {
      const result = await askOllama("What is the content of this text file?", {
        files: [{ path: "test/data/data.csv", type: "text" }],
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should return a structured output and cache it", async () => {
      const schema = z.toJSONSchema(
        z.object({
          people: z.array(
            z.object({
              name: z.string(),
              age: z.number(),
              gender: z.enum(["man", "woman"]),
            }),
          ),
        }),
      );

      const result = await askOllama("Give me 10 random people. Return JSON.", {
        cache: true,
        schemaJson: schema,
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should return a cached structured output", async () => {
      const schema = z.toJSONSchema(
        z.object({
          people: z.array(
            z.object({
              name: z.string(),
              age: z.number(),
              gender: z.enum(["man", "woman"]),
            }),
          ),
        }),
      );

      const result = await askOllama("Give me 10 random people. Return JSON.", {
        cache: true,
        schemaJson: schema,
      });
      console.log(result);
      assertEquals(result.fromCache, true);
    });
    test("should work without a system prompt", async () => {
      const result = await askOllama("Why is the sky blue?", {
        thinkingLevel: "low",
      });
      console.log(result);
      assertEquals(true, true);
    });
    test("should work with a system prompt", async () => {
      const result = await askOllama("Why is the sky blue?", {
        systemPrompt: "Always answer with rhymes.",
        thinkingLevel: "low",
      });
      console.log(result);
      assertEquals(result.systemPrompt, "Always answer with rhymes.");
      assertEquals(true, true);
    });
    test("should work with thinking level low", async () => {
      const result = await askOllama(
        "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
        { thinkingLevel: "low" },
      );
      console.log(result);
      assertEquals(result.thinkingLevel, "low");
      assertEquals(true, true);
    });
    test("should work with thinking level medium", async () => {
      const result = await askOllama(
        "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
        { thinkingLevel: "medium" },
      );
      console.log(result);
      assertEquals(result.thinkingLevel, "medium");
      assertEquals(true, true);
    });
    test("should not use cached response when thinking level changes", async () => {
      const withoutThinking = await askOllama("Find 12 * 13. Return just the number.", {
        cache: true,
      });
      const withThinking = await askOllama("Find 12 * 13. Return just the number.", {
        thinkingLevel: "medium",
        cache: true,
      });
      console.log({ withoutThinking, withThinking });
      assertEquals(withoutThinking.thinkingLevel, null);
      assertEquals(withThinking.thinkingLevel, "medium");
      assertEquals(withThinking.fromCache, false);
    });
    test("should work with thinking level high", async () => {
      const result = await askOllama(
        "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
        { thinkingLevel: "high" },
      );
      console.log(result);
      assertEquals(result.thinkingLevel, "high");
      assertEquals(true, true);
    });
  },
);
