import { beforeEach, afterEach, test, expect, expectTypeOf, vi } from "vite-plus/test";
import { rmSync } from "node:fs";
import { APICallError, type LanguageModel } from "ai";
import { z } from "zod";
import { askAI, askAIPool } from "../../src/index.ts";

beforeEach(() => {
  rmSync(".journalism-cache", { recursive: true, force: true });
  for (const name of [
    "AI_PROVIDER",
    "AI_MODEL",
    "AI_KEY",
    "AI_PROJECT",
    "AI_LOCATION",
    "OLLAMA_HOST",
  ])
    vi.stubEnv(name, undefined);
  vi.stubEnv("AI_PROVIDER", "pool-test");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function adapter(
  execute: (prompt: string) => string | Promise<string>,
): Extract<LanguageModel, { specificationVersion: "v4" }> {
  return {
    specificationVersion: "v4",
    provider: "pool-test",
    modelId: "pool-model",
    supportedUrls: {},
    async doGenerate(request) {
      const prompt = request.prompt
        .flatMap((message) =>
          message.role === "user"
            ? message.content.flatMap((part) => (part.type === "text" ? [part.text] : []))
            : [],
        )
        .join("\n");
      const text = await execute(prompt);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      };
    },
    doStream() {
      return Promise.reject(new Error("unused"));
    },
  };
}

test("bounds concurrency, fills available workers and returns results with IDs in input order", async () => {
  const slowEntered = Promise.withResolvers<void>();
  const thirdEntered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let active = 0;
  let maximum = 0;
  const calls: string[] = [];
  const model = adapter(async (prompt) => {
    calls.push(prompt);
    active++;
    maximum = Math.max(maximum, active);
    if (prompt === "one") {
      slowEntered.resolve();
      await release.promise;
    }
    if (prompt === "three") thirdEntered.resolve();
    active--;
    return prompt;
  });
  const requests = ["one", "two", "three"].map((prompt) => ({
    id: prompt,
    prompt,
    options: { model, cacheKey: "pool-deployment" },
  }));
  const pending = askAIPool(requests, 2);
  await slowEntered.promise;
  await thirdEntered.promise;
  expect(calls).toEqual(["one", "two", "three"]);
  release.resolve();
  const result = await pending;
  expect(maximum).toBe(2);
  expect(result.errors).toEqual([]);
  expect(result.results.map((entry) => entry.request.id)).toEqual(["one", "two", "three"]);
  expect(result.results.map((entry) => entry.result.response)).toEqual(["one", "two", "three"]);
});

test("response validation is retried and retains processor return types", async () => {
  let requests = 0;
  let callbacks = 0;
  const model = adapter(() => {
    requests++;
    return "raw";
  });
  const result = await askAIPool(
    [
      {
        prompt: "validate",
        options: {
          model,
          cacheKey: "pool-deployment",
          processResponse: async (value) => {
            if (++callbacks === 1) throw new Error("try again");
            return { value: z.string().parse(value).toUpperCase() };
          },
        },
      },
    ],
    1,
    { retry: 1 },
  );
  expectTypeOf(result.results[0]?.result.response).toEqualTypeOf<{ value: string }>();
  expect(result.results[0]?.result.response).toEqual({ value: "RAW" });
  expect(result.errors).toEqual([]);
  expect(requests).toBe(2);
  expect(callbacks).toBe(2);
});

test("a rejected cache hit is removed before the pool retries generation", async () => {
  let requests = 0;
  let callbacks = 0;
  const model = adapter(() => {
    requests++;
    return "raw";
  });
  const options = { model, cacheKey: "pool-deployment" };
  await askAI("cached", options);
  const result = await askAIPool(
    [
      {
        prompt: "cached",
        options: {
          ...options,
          processResponse: (value) => {
            if (++callbacks === 1) throw new Error("reject cache");
            return z.string().parse(value);
          },
        },
      },
    ],
    1,
    { retry: 1 },
  );
  expect(result.results[0]?.result.response).toBe("raw");
  expect(requests).toBe(2);
  expect(callbacks).toBe(2);
});

test("one retry budget applies to transient provider errors without nested SDK retries", async () => {
  let requests = 0;
  const model = adapter(() => {
    requests++;
    throw new APICallError({
      message: "unavailable",
      url: "https://offline.example",
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    });
  });
  const result = await askAIPool([{ prompt: "failure", options: { model, cache: false } }], 1, {
    retry: 2,
  });
  expect(requests).toBe(3);
  expect(result.results).toEqual([]);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]?.index).toBe(0);
});

test("retryCheck can asynchronously prevent retrying a terminal failure", async () => {
  let requests = 0;
  const terminal = new Error("terminal");
  const model = adapter(() => {
    requests++;
    throw terminal;
  });
  const retryCheck = vi.fn(async (error: unknown) => {
    expect(error).toBe(terminal);
    return false;
  });
  const result = await askAIPool([{ prompt: "terminal", options: { model, cache: false } }], 1, {
    retry: 3,
    retryCheck,
  });
  expect(requests).toBe(1);
  expect(retryCheck).toHaveBeenCalledTimes(1);
  expect(result.errors[0]?.error).toBe(terminal);
});

test("minimum attempt duration spaces requests on each worker", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const starts: number[] = [];
  const model = adapter((prompt) => {
    starts.push(Date.now());
    return prompt;
  });
  const pending = askAIPool(
    ["one", "two"].map((prompt) => ({ prompt, options: { model, cache: false } })),
    1,
    { minRequestDurationMs: 100 },
  );
  await vi.runAllTimersAsync();
  await pending;
  expect(starts).toEqual([0, 100]);
});

test("pool cache hits skip request hooks and still run response processors", async () => {
  let requests = 0;
  let hooks = 0;
  let processors = 0;
  const model = adapter(() => {
    requests++;
    return "raw";
  });
  const options = {
    model,
    cacheKey: "pool-deployment",
    beforeRequest: () => {
      hooks++;
    },
    processResponse: (value: unknown) => {
      processors++;
      return z.string().parse(value);
    },
  };
  const result = await askAIPool(
    [
      { prompt: "same", options },
      { prompt: "same", options },
    ],
    1,
  );
  expect(requests).toBe(1);
  expect(hooks).toBe(1);
  expect(processors).toBe(2);
  expect(result.results.map((entry) => entry.result.fromCache)).toEqual([false, true]);
});

test("captures environment configuration before workers start", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubEnv("AI_MODEL", "pool-model");
  const models: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    models.push(z.object({ model: z.string() }).parse(await request.json()).model);
    vi.stubEnv("AI_PROVIDER", "invalid");
    vi.stubEnv("AI_MODEL", "changed");
    return Response.json({
      model: "pool-model",
      done: true,
      done_reason: "stop",
      message: { role: "assistant", content: "ready" },
      prompt_eval_count: 1,
      eval_count: 1,
    });
  };
  const result = await askAIPool(
    [
      { prompt: "one", options: { fetch } },
      { prompt: "two", options: { fetch } },
    ],
    1,
  );
  expect(result.errors).toEqual([]);
  expect(models).toEqual(["pool-model", "pool-model"]);
});

test("Google Agent Platform pools accept an API key without a project", async () => {
  vi.stubEnv("AI_PROVIDER", "google-agent-platform");
  vi.stubEnv("AI_KEY", "test-key");
  vi.stubEnv("AI_MODEL", "gemini-3.5-flash");
  const fetch: typeof globalThis.fetch = async () =>
    Response.json({
      candidates: [
        { content: { role: "model", parts: [{ text: "ready" }] }, finishReason: "STOP" },
      ],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    });
  const result = await askAIPool([{ prompt: "ready", options: { fetch } }], 1);
  expect(result.errors).toEqual([]);
  expect(result.results[0]?.result.response).toBe("ready");
});

test("queued prompts and IDs are captured before caller mutations", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const model = adapter(async (prompt) => {
    if (prompt === "one") {
      entered.resolve();
      await release.promise;
    }
    return prompt;
  });
  const requests = ["one", "two"].map((prompt) => ({
    id: prompt,
    prompt,
    options: { model, cache: false },
  }));
  const pending = askAIPool(requests, 1);
  await entered.promise;
  requests[1].prompt = "changed";
  requests[1].id = "changed";
  release.resolve();
  const result = await pending;
  expect(result.results[1]?.request.id).toBe("two");
  expect(result.results[1]?.result.response).toBe("two");
});

test("empty pools and invalid controls are handled without provider calls", async () => {
  expect(await askAIPool([], 2)).toEqual({ results: [], errors: [] });
  for (const poolSize of [0, -1, 1.5])
    await expect(askAIPool([], poolSize)).rejects.toThrow("poolSize");
  await expect(askAIPool([], 1, { retry: -1 })).rejects.toThrow("retry");
  await expect(askAIPool([], 1, { minRequestDurationMs: Infinity })).rejects.toThrow(
    "minRequestDurationMs",
  );
});

test("progress reports successful and failed requests", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const model = adapter((prompt) => {
    if (prompt === "bad") throw new Error("bad");
    return prompt;
  });
  await askAIPool(
    ["good", "bad"].map((prompt) => ({ prompt, options: { model, cache: false } })),
    1,
    { logProgress: true },
  );
  expect(log).toHaveBeenCalledWith("[askAIPool] Request 0 processed");
  expect(log).toHaveBeenCalledWith("[askAIPool] Request 1 failed");
});
