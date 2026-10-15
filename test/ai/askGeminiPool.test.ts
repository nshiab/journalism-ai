import { test, describe, expect, vi } from "vite-plus/test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import askGeminiPool, { runAskGeminiPool } from "../../src/ai/askGeminiPool.ts";
import type { AskGeminiOptions, GeminiDetailedResponse } from "../../src/ai/askGemini.ts";
import * as z from "zod";

function fakeGeminiResult<TResponse>(response: TResponse): GeminiDetailedResponse<TResponse> {
  return {
    response,
    fromCache: false,
    prompt: "prompt",
    systemPrompt: null,
    webSearch: false,
    thinkingLevel: null,
    safetyEnabled: false,
    files: [],
    promptTokenCount: 0,
    outputTokenCount: 0,
    totalTokens: 0,
    tokensPerSecond: 0,
    estimatedCost: null,
    durationMs: 0,
    model: "test",
    thoughts: null,
    thoughtsTokenCount: 0,
  };
}

test("retries synchronous response validation and preserves its type", async () => {
  let attempts = 0;
  const executeRequest = async (_prompt: string, options: AskGeminiOptions<{ value: string }>) => {
    const response = options.processResponse
      ? await options.processResponse("raw")
      : { value: "raw" };
    return fakeGeminiResult(response);
  };

  const { results, errors } = await runAskGeminiPool(
    [
      {
        prompt: "prompt",
        processResponse: () => {
          attempts++;
          if (attempts === 1) {
            throw new Error("retry");
          }
          return { value: "processed" };
        },
      },
    ],
    1,
    { retry: 1 },
    executeRequest,
  );

  assertEquals(errors.length, 0);
  assertEquals(results[0].result.response.value, "processed");
  assertEquals(attempts, 2);
});

test("supports async response processing and terminal failures", async () => {
  const executeRequest = async (_prompt: string, options: AskGeminiOptions<string>) => {
    const response = options.processResponse ? await options.processResponse("raw") : "raw";
    return fakeGeminiResult(response);
  };

  const successful = await runAskGeminiPool(
    [
      {
        prompt: "prompt",
        processResponse: async (response) => `${String(response)}-processed`,
      },
    ],
    1,
    {},
    executeRequest,
  );
  const failed = await runAskGeminiPool(
    [
      {
        prompt: "prompt",
        processResponse: () => {
          throw new Error("terminal");
        },
      },
    ],
    1,
    { retry: 1 },
    executeRequest,
  );

  assertEquals(successful.results[0].result.response, "raw-processed");
  assertEquals(failed.results.length, 0);
  assertEquals(failed.errors.length, 1);
  const error = failed.errors[0].error;
  if (!(error instanceof Error)) throw new Error("Expected terminal Error");
  assertEquals(error.message, "terminal");
});

const aiKey = process.env.AI_KEY || (process.env.AI_PROJECT && process.env.AI_LOCATION);
describe.skipIf(process.env.CI === "true" || !aiKey || !process.env.AI_MODEL)("live Gemini", () => {
  test("should run the doc example", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
      ],
      5,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].result.webSearch, false);
    assertEquals(results[0].result.thinkingLevel, null);
    assertEquals(results[0].result.safetyEnabled, false);
  });
  test("should use request ids", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { id: "france", prompt: "What is the capital of France?" },
        { id: "germany", prompt: "What is the capital of Germany?" },
      ],
      2,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 2);
    assertEquals(results[0].request.id, "france");
    assertEquals(results[1].request.id, "germany");
  });
  test("should process requests with options", async () => {
    const schema = z.toJSONSchema(z.array(z.string()));
    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "Give me a list of 3 countries in Europe.",
          options: {
            schemaJson: schema,
            systemPrompt: "Answer as a concise travel researcher.",
          },
        },
        {
          prompt: "Give me a list of 3 countries in Asia.",
          options: { schemaJson: schema },
        },
      ],
      2,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 2);
    assertEquals(results[0].result.systemPrompt, "Answer as a concise travel researcher.");
  });
  test("should process responses inside the retry loop", async () => {
    let attempts = 0;
    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "Reply with the word ready.",
          processResponse: () => {
            attempts++;
            if (attempts === 1) {
              throw new Error("Try the response again.");
            }
            return "processed";
          },
          options: { cache: true },
        },
      ],
      1,
      { retry: 1 },
    );

    assertEquals(errors.length, 0);
    assertEquals(results[0].result.response, "processed");
    assertEquals(attempts, 2);
  });
  test("should log progress", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
        { prompt: "What is the capital of Spain?" },
        { prompt: "What is the capital of Portugal?" },
        { prompt: "What is the capital of Greece?" },
        { prompt: "What is the capital of Netherlands?" },
        { prompt: "What is the capital of Belgium?" },
        { prompt: "What is the capital of Switzerland?" },
        { prompt: "What is the capital of Austria?" },
        { prompt: "What is the capital of Poland?" },
        { prompt: "What is the capital of Czech Republic?" },
      ],
      5,
      { logProgress: true },
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 12);
  });
  test("should accumulate cost and tokens from pool results", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
      ],
      2,
      { logProgress: true },
    );
    const totalCost = results.reduce((sum, r) => sum + (r.result.estimatedCost ?? 0), 0);
    const totalTokens = results.reduce((sum, r) => sum + r.result.totalTokens, 0);
    console.log({ results, errors });
    console.log("Total cost:", totalCost);
    console.log("Total tokens:", totalTokens);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  test("should enforce minimum request duration", async () => {
    const start = Date.now();
    const { results, errors } = await askGeminiPool(
      [{ prompt: "What is the capital of France?" }, { prompt: "What is the capital of Germany?" }],
      1,
      { minRequestDurationMs: 2000 },
    );
    const duration = Date.now() - start;
    console.log(`Duration: ${duration}ms`);
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 2);
  });
  test("should return results sorted by original index", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
      ],
      3,
    );

    console.log({ results, errors });
    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].index, 0);
    assertEquals(results[1].index, 1);
    assertEquals(results[2].index, 2);
  });
  test("should use thinking level medium", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "How do you feel?", options: { thinkingLevel: "medium" } },
        { prompt: "Where do you live?", options: { thinkingLevel: "medium" } },
        {
          prompt: "Do you have a consciousness?",
          options: { thinkingLevel: "medium" },
        },
      ],
      1,
      { logProgress: true },
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].result.webSearch, false);
    assertEquals(results[0].result.thinkingLevel, "medium");
  });
  test("should run with high thinking level", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "How do you feel?", options: { thinkingLevel: "high" } },
        { prompt: "Where do you live?", options: { thinkingLevel: "high" } },
        {
          prompt: "Do you have a consciousness?",
          options: { thinkingLevel: "high" },
        },
      ],
      1,
      { logProgress: true },
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].result.thinkingLevel, "high");
  });
  test("should use a text file as input", async () => {
    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "What is the content of this text file?",
          options: {
            files: [{ path: "test/data/data.csv", type: "text" }],
          },
        },
      ],
      1,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 1);
  });
  test("should not ground results with web search", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "Who is Nael Shiab (CBC News)?" },
        { prompt: "Who is Elizabeth Haggarty (CBC News)?" },
        { prompt: "Who is Graeme Bruce (CBC News)?" },
      ],
      5,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].result.webSearch, false);
  });
  test("should ground results with web search", async () => {
    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "Who is Nael Shiab (CBC News)?",
          options: { webSearch: true },
        },
        {
          prompt: "Who is Elizabeth Haggarty (CBC News)?",
          options: { webSearch: true },
        },
        {
          prompt: "Who is Graeme Bruce (CBC News)?",
          options: { webSearch: true },
        },
      ],
      5,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].result.webSearch, true);
  });
  test("should return structured output", async () => {
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

    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "Give me 5 characters from Harry Potter.",
          options: { schemaJson: schema },
        },
        {
          prompt: "Give me 5 characters from Lord of the Rings.",
          options: { schemaJson: schema },
        },
        {
          prompt: "Give me 5 characters from Avengers.",
          options: { schemaJson: schema },
        },
      ],
      5,
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  test("should run without thinking level by default", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "How do you feel?" },
        { prompt: "Where do you live?" },
        { prompt: "Do you have a consciousness?" },
      ],
      1,
      { logProgress: true },
    );
    console.log({ results, errors });

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
});

test("pool concurrency is bounded and results retain input order", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let active = 0;
  let maximum = 0;
  const calls: string[] = [];
  const pending = runAskGeminiPool(
    [{ prompt: "slow" }, { prompt: "fast" }, { prompt: "third" }],
    2,
    {},
    async (prompt) => {
      active++;
      maximum = Math.max(maximum, active);
      calls.push(prompt);
      if (prompt === "slow") {
        entered.resolve();
        await release.promise;
      }
      active--;
      return fakeGeminiResult(prompt);
    },
  );
  await entered.promise;
  await Promise.resolve();
  expect(calls).toEqual(["slow", "fast", "third"]);
  release.resolve();
  const result = await pending;
  expect(maximum).toBe(2);
  expect(result.errors).toEqual([]);
  expect(result.results.map((entry) => entry.result.response)).toEqual(["slow", "fast", "third"]);
});

test("retryCheck can prevent retries and accepts asynchronous decisions", async () => {
  let calls = 0;
  const error = new Error("terminal provider failure");
  const result = await runAskGeminiPool(
    [{ prompt: "request" }],
    2,
    {
      retry: 3,
      retryCheck: async (failure) => {
        expect(failure).toBe(error);
        return false;
      },
    },
    () => {
      calls++;
      return Promise.reject(error);
    },
  );
  expect(calls).toBe(1);
  expect(result.results).toEqual([]);
  expect(result.errors[0]?.error).toBe(error);
});

test("minimum request duration spaces consecutive requests", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  try {
    const starts: number[] = [];
    const pending = runAskGeminiPool(
      [{ prompt: "one" }, { prompt: "two" }],
      1,
      { minRequestDurationMs: 100 },
      (prompt) => {
        starts.push(Date.now());
        return Promise.resolve(fakeGeminiResult(prompt));
      },
    );
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(starts).toEqual([0, 100]);
    expect(result.results).toHaveLength(2);
  } finally {
    vi.useRealTimers();
  }
});
