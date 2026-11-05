import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { askAI } from "../../src/index.ts";

type Options = NonNullable<Parameters<typeof askAI>[1]>;
type Provider = NonNullable<Options["provider"]>;
const providers: Provider[] = ["openai", "anthropic", "gemini", "vertex", "ollama"];

beforeEach(() => {
  vi.stubGlobal("AI_SDK_LOG_WARNINGS", false);
  for (const name of [
    "AI_PROVIDER",
    "AI_PROJECT",
    "AI_LOCATION",
    "AI_KEY",
    "AI_MODEL",
    "OLLAMA",
    "OLLAMA_HOST",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_VERTEX_API_KEY",
    "GOOGLE_VERTEX_PROJECT",
    "GOOGLE_VERTEX_LOCATION",
    "OPENAI_MODEL",
    "ANTHROPIC_MODEL",
    "GEMINI_MODEL",
    "VERTEX_MODEL",
    "OLLAMA_MODEL",
  ])
    vi.stubEnv(name, undefined);
  rmSync(".journalism-cache", { recursive: true, force: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function payload(provider: Provider, text: string, finish = "stop"): unknown {
  if (provider === "openai")
    return {
      id: "resp_mock",
      object: "response",
      created_at: 0,
      status: finish === "stop" ? "completed" : "incomplete",
      error: null,
      incomplete_details: finish === "stop" ? null : { reason: "max_output_tokens" },
      model: "test-model",
      output: [
        {
          id: "msg_mock",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    };
  if (provider === "anthropic")
    return {
      id: "msg_mock",
      type: "message",
      role: "assistant",
      model: "test-model",
      content: [{ type: "text", text }],
      stop_reason: finish === "stop" ? "end_turn" : "max_tokens",
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    };
  if (provider === "ollama")
    return {
      model: "test-model",
      done: true,
      done_reason: finish === "stop" ? "stop" : "length",
      message: { role: "assistant", content: text, thinking: "a thought" },
      prompt_eval_count: 10,
      eval_count: 5,
    };
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        finishReason: finish === "stop" ? "STOP" : "MAX_TOKENS",
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  };
}

function transport(provider: Provider, text = "Paris", finish = "stop") {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({
      url: request.url,
      headers: request.headers,
      body: z.record(z.string(), z.unknown()).parse(await request.json()),
    });
    return Response.json(payload(provider, text, finish), { headers: { "request-id": "mock" } });
  };
  return { requests, fetch };
}

function options(provider: Provider): Options {
  return {
    provider,
    model: "test-model",
    maxOutputTokens: 256,
    ...(provider === "ollama" ? {} : { apiKey: "test-secret" }),
    ...(provider === "vertex" ? { project: "project-a", location: "us-central1" } : {}),
  };
}

for (const provider of providers) {
  test(`${provider} uses the common pipeline, usage metadata and cache processing`, async () => {
    const mock = transport(provider);
    const settings = { ...options(provider), fetch: mock.fetch };
    const first = await askAI("capital", settings);
    const second = await askAI("capital", {
      ...settings,
      processResponse: (value) => z.string().parse(value).toUpperCase(),
    });
    expectTypeOf(second.response).toEqualTypeOf<string>();
    expect(first).toMatchObject({
      response: "Paris",
      provider,
      model: "test-model",
      fromCache: false,
      promptTokenCount: 10,
      outputTokenCount: 5,
      totalTokens: 15,
      estimatedCost: null,
      finishReason: "stop",
    });
    expect(second).toMatchObject({ response: "PARIS", fromCache: true });
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]?.url).toContain(
      provider === "vertex"
        ? "aiplatform.googleapis.com"
        : provider === "ollama"
          ? "11434/api/chat"
          : provider === "gemini"
            ? "generativelanguage.googleapis.com"
            : provider === "openai"
              ? "api.openai.com/v1/responses"
              : "api.anthropic.com/v1/messages",
    );
    for (const file of readdirSync(".journalism-cache"))
      expect(readFileSync(`.journalism-cache/${file}`, "utf8")).not.toContain("test-secret");
  });

  test(`${provider} supports array schemas using a shared object envelope`, async () => {
    const mock = transport(provider, JSON.stringify({ response: ["France", "Canada"] }));
    const result = await askAI("countries", {
      ...options(provider),
      fetch: mock.fetch,
      schemaJson: z.toJSONSchema(z.array(z.string())),
      processResponse: async (value) => z.array(z.string()).parse(value),
    });
    expectTypeOf(result.response).toEqualTypeOf<string[]>();
    expect(result.response).toEqual(["France", "Canada"]);
    expect(JSON.stringify(mock.requests[0]?.body)).toContain('"response"');
  });

  test(`${provider} never caches truncated responses`, async () => {
    const mock = transport(provider, "incomplete", "length");
    const settings = { ...options(provider), fetch: mock.fetch };
    await expect(askAI("truncated", settings)).rejects.toThrow();
    await expect(askAI("truncated", settings)).rejects.toThrow();
    expect(mock.requests).toHaveLength(2);
    expect(readdirSync(".journalism-cache")).toEqual([]);
  });
}

test("explicit providers beat ambient Google configuration and use their own credentials", async () => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("AI_PROJECT", "google-project");
  vi.stubEnv("AI_LOCATION", "global");
  vi.stubEnv("AI_KEY", "google-secret");
  vi.stubEnv("OPENAI_API_KEY", "openai-secret");
  const mock = transport("openai");
  await askAI("explicit", { provider: "openai", model: "test-model", fetch: mock.fetch });
  expect(mock.requests[0]?.headers.get("authorization")).toBe("Bearer openai-secret");
  expect(mock.requests[0]?.url).toContain("api.openai.com");
});

test("environment provider/model selection and legacy Vertex selector work", async () => {
  vi.stubEnv("AI_PROVIDER", "anthropic");
  vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-secret");
  vi.stubEnv("ANTHROPIC_MODEL", "test-model");
  const anthropic = transport("anthropic");
  expect(
    (await askAI("environment", { fetch: anthropic.fetch, maxOutputTokens: 256 })).provider,
  ).toBe("anthropic");
  const vertex = transport("vertex");
  expect(
    (
      await askAI("vertex alias", {
        ...options("vertex"),
        provider: "gemini",
        vertex: true,
        fetch: vertex.fetch,
      })
    ).provider,
  ).toBe("vertex");
});

test("explicit Google backend selection wins over environment defaults", async () => {
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("AI_PROJECT", "ambient-project");
  vi.stubEnv("AI_LOCATION", "global");
  const gemini = transport("gemini");
  expect(
    (
      await askAI("force Gemini", {
        model: "test-model",
        apiKey: "gemini-key",
        vertex: false,
        fetch: gemini.fetch,
      })
    ).provider,
  ).toBe("gemini");
  const vertex = transport("vertex");
  expect(
    (
      await askAI("force Vertex", {
        model: "test-model",
        apiKey: "vertex-key",
        vertex: true,
        fetch: vertex.fetch,
      })
    ).provider,
  ).toBe("vertex");
  vi.stubEnv("AI_PROVIDER", undefined);
  expect(
    (
      await askAI("explicit Gemini key", {
        model: "test-model",
        apiKey: "gemini-key",
        fetch: gemini.fetch,
      })
    ).provider,
  ).toBe("gemini");
  expect(gemini.requests).toHaveLength(2);
});

test("invalid provider, mismatched deployment options, missing model and missing credentials fail before dispatch", async () => {
  const mock = transport("openai");
  vi.stubEnv("AI_PROVIDER", "invalid");
  await expect(askAI("invalid", { model: "test-model", fetch: mock.fetch })).rejects.toThrow(
    "Unsupported AI provider",
  );
  await expect(
    askAI("invalid", { ...options("openai"), vertex: true, fetch: mock.fetch }),
  ).rejects.toThrow("vertex is only valid");
  await expect(
    askAI("invalid", { ...options("openai"), project: "wrong", fetch: mock.fetch }),
  ).rejects.toThrow("require the Vertex");
  await expect(
    askAI("missing model", { provider: "openai", apiKey: "key", fetch: mock.fetch }),
  ).rejects.toThrow("Model not specified");
  vi.stubEnv("AI_KEY", "google-only");
  await expect(
    askAI("missing key", { provider: "openai", model: "test-model", fetch: mock.fetch }),
  ).rejects.toThrow("OPENAI_API_KEY");
  expect(mock.requests).toEqual([]);
});

test("cache separates providers, models, endpoints and semantic settings but excludes credentials and retry controls", async () => {
  const openai = transport("openai");
  const base = { ...options("openai"), fetch: openai.fetch };
  await askAI("identity", base);
  expect((await askAI("identity", { ...base, apiKey: "rotated", maxRetries: 1 })).fromCache).toBe(
    true,
  );
  for (const settings of [
    { ...base, model: "different" },
    { ...base, baseURL: "https://other.example/v1" },
    { ...base, temperature: 0.3 },
    { ...base, maxOutputTokens: 999 },
    { ...base, providerOptions: { openai: { store: false } } },
    { ...base, cacheKey: "remote-object-v2" },
  ])
    await askAI("identity", settings);
  expect(openai.requests).toHaveLength(7);
  const anthropic = transport("anthropic");
  expect(
    (await askAI("identity", { ...options("anthropic"), fetch: anthropic.fetch })).fromCache,
  ).toBe(false);
  expect(anthropic.requests).toHaveLength(1);
});

test("callbacks run on every call and cannot mutate the cached original", async () => {
  const mock = transport("openai", '{"response":{"value":7}}');
  const base = {
    ...options("openai"),
    fetch: mock.fetch,
    schemaJson: z.toJSONSchema(z.object({ value: z.number() })),
  };
  for (const increment of [1, 2, 3]) {
    const result = await askAI("mutable", {
      ...base,
      processResponse: async (value) => {
        if (
          typeof value !== "object" ||
          value === null ||
          !("value" in value) ||
          typeof value.value !== "number"
        )
          throw new Error("Expected numeric value");
        value.value += increment;
        return value;
      },
    });
    expect(result.response).toEqual({ value: 7 + increment });
  }
  expect(mock.requests).toHaveLength(1);
  await expect(
    askAI("mutable", {
      ...base,
      processResponse: () => {
        throw new Error("rejected");
      },
    }),
  ).rejects.toThrow("rejected");
  expect((await askAI("mutable", base)).fromCache).toBe(false);
  expect(mock.requests).toHaveLength(2);
});

test("schema failures and processor failures never write successful entries", async () => {
  const mock = transport("openai", '{"response":{"value":"wrong"}}');
  const base = { ...options("openai"), fetch: mock.fetch };
  await expect(
    askAI("schema", { ...base, schemaJson: z.toJSONSchema(z.object({ value: z.number() })) }),
  ).rejects.toThrow();
  await expect(
    askAI("processor", {
      ...base,
      processResponse: () => {
        throw new Error("failed processing");
      },
    }),
  ).rejects.toThrow("failed processing");
  expect(readdirSync(".journalism-cache")).toEqual([]);
});

test("text and image file bytes, order and MIME types reach adapters and invalidate edited-file cache", async () => {
  writeFileSync("article.txt", "first article");
  writeFileSync("photo.png", "first image");
  const mock = transport("openai");
  const base: Options = {
    ...options("openai"),
    fetch: mock.fetch,
    files: [
      { path: "article.txt", type: "text" },
      { path: "photo.png", type: "image" },
    ],
  };
  await askAI("files", base);
  expect(JSON.stringify(mock.requests[0]?.body)).toContain("first article");
  expect(JSON.stringify(mock.requests[0]?.body)).toContain("data:image/png;base64,");
  expect((await askAI("files", base)).fromCache).toBe(true);
  writeFileSync("article.txt", "changed article");
  await askAI("files", base);
  writeFileSync("photo.png", "changed image");
  await askAI("files", base);
  expect(mock.requests).toHaveLength(3);
});

test("unsupported files and secret-bearing endpoints reject before network dispatch", async () => {
  const mock = transport("openai");
  await expect(
    askAI("audio", {
      ...options("openai"),
      fetch: mock.fetch,
      files: [{ path: "a.mp3", type: "audio" }],
    }),
  ).rejects.toThrow("audio/video");
  await expect(
    askAI("GCS", {
      ...options("openai"),
      fetch: mock.fetch,
      files: [{ path: "gs://bucket/a.pdf", type: "pdf" }],
    }),
  ).rejects.toThrow("require the Vertex");
  for (const baseURL of [
    "https://user:password@example.com",
    "https://example.com?key=secret",
    "file:///tmp/api",
  ])
    await expect(
      askAI("endpoint", { ...options("openai"), baseURL, fetch: mock.fetch }),
    ).rejects.toThrow("baseURL");
  expect(mock.requests).toEqual([]);
});

test("Vertex forwards GCS inputs, Google settings and native search", async () => {
  const mock = transport("vertex");
  await askAI("Vertex inputs", {
    ...options("vertex"),
    model: "gemini-3.5-flash",
    fetch: mock.fetch,
    webSearch: true,
    files: [{ path: "gs://bucket/report.pdf", type: "pdf" }],
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 128, includeThoughts: true } } },
  });
  const serialized = JSON.stringify(mock.requests[0]?.body);
  expect(serialized).toContain("gs://bucket/report.pdf");
  expect(serialized).toContain("googleSearch");
  expect(serialized).toContain("thinkingBudget");
});

test("Ollama retains context, thinking, token limit and official-client options", async () => {
  writeFileSync("ollama-article.txt", "article text");
  writeFileSync("ollama-image.png", "image bytes");
  const mock = transport("ollama");
  await askAI("Ollama", {
    ...options("ollama"),
    fetch: mock.fetch,
    maxOutputTokens: 256,
    temperature: 0,
    systemPrompt: "Be concise.",
    files: [
      { path: "ollama-article.txt", type: "text" },
      { path: "ollama-image.png", type: "image" },
    ],
    providerOptions: { ollama: { contextWindow: 8192, thinkingLevel: "low", keepAlive: "5m" } },
  });
  expect(mock.requests[0]?.body).toMatchObject({
    think: "low",
    keep_alive: "5m",
    stream: false,
    options: { num_ctx: 8192, num_predict: 256, temperature: 0 },
    messages: [
      { role: "system", content: "Be concise." },
      {
        role: "user",
        content: "Ollama\n\narticle text",
        images: [Buffer.from("image bytes").toString("base64")],
      },
    ],
  });
});

test("custom adapters use the same pipeline without a built-in provider registration", async () => {
  const mock = transport("openai");
  const model = createOpenAI({
    apiKey: "custom-secret",
    baseURL: "https://custom.example/v1",
    fetch: mock.fetch,
  }).responses("custom-model");
  await expect(askAI("custom", { model })).rejects.toThrow("cacheKey");
  const base = { model, cacheKey: "custom-deployment" };
  expect((await askAI("custom", base)).fromCache).toBe(false);
  expect((await askAI("custom", base)).fromCache).toBe(true);
  expect((await askAI("custom", { ...base, cacheKey: "different-deployment" })).fromCache).toBe(
    false,
  );
  await expect(askAI("custom", { ...base, provider: "openai" })).rejects.toThrow(
    "custom model adapter",
  );
  expect(mock.requests).toHaveLength(2);
});

test("request hook skips cache hits, prevents dispatch when rejected, and applies with caching disabled", async () => {
  const mock = transport("openai");
  const events: string[] = [];
  const beforeRequest = async () => {
    await Promise.resolve();
    events.push("hook");
  };
  const fetch: typeof globalThis.fetch = (input, init) => {
    events.push("fetch");
    return mock.fetch(input, init);
  };
  const base = { ...options("openai"), fetch, beforeRequest };
  await askAI("hook", base);
  await askAI("hook", base);
  await askAI("hook", { ...base, cache: false });
  expect(events).toEqual(["hook", "fetch", "hook", "fetch"]);
  await expect(
    askAI("rejected hook", {
      ...base,
      beforeRequest: () => {
        throw new Error("hook failed");
      },
    }),
  ).rejects.toThrow("hook failed");
  expect(mock.requests).toHaveLength(2);
});

test("transport retries are opt-in and call the request hook for each dispatch", async () => {
  vi.useFakeTimers();
  try {
    const mock = transport("openai");
    let attempts = 0;
    let hooks = 0;
    const fetch: typeof globalThis.fetch = (input, init) => {
      attempts++;
      return attempts % 2 === 1
        ? Promise.resolve(Response.json({ error: { message: "temporary" } }, { status: 503 }))
        : mock.fetch(input, init);
    };
    const base = {
      ...options("openai"),
      cache: false,
      fetch,
      beforeRequest: () => {
        hooks++;
      },
    };
    await expect(askAI("no retry", base)).rejects.toThrow();
    attempts = 0;
    hooks = 0;
    const pending = askAI("retry", { ...base, maxRetries: 1 });
    await vi.runAllTimersAsync();
    await pending;
    expect(attempts).toBe(2);
    expect(hooks).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

test("aborted requests do not dispatch or cache responses", async () => {
  const mock = transport("openai");
  const controller = new AbortController();
  controller.abort();
  await expect(
    askAI("aborted", { ...options("openai"), fetch: mock.fetch, abortSignal: controller.signal }),
  ).rejects.toThrow();
  expect(mock.requests).toEqual([]);
});

test("custom provider usage, thoughts, warnings and citations survive caching", async () => {
  let requests = 0;
  const model: Extract<LanguageModel, { specificationVersion: "v4" }> = {
    specificationVersion: "v4",
    provider: "another-vendor",
    modelId: "another-model",
    supportedUrls: {},
    async doGenerate() {
      requests++;
      return {
        content: [
          { type: "reasoning", text: "thought" },
          { type: "text", text: "Paris" },
          {
            type: "source",
            sourceType: "url",
            id: "source",
            url: "https://example.com/source",
            title: "Source",
          },
        ],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 3, reasoning: 2 },
        },
        warnings: [{ type: "unsupported", feature: "temperature", details: "Model default used" }],
      };
    },
    doStream() {
      return Promise.reject(new Error("unused"));
    },
  };
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const first = await askAI("custom metadata", { model, cacheKey: "another-deployment" });
  const second = await askAI("custom metadata", { model, cacheKey: "another-deployment" });
  expect(first).toMatchObject({
    provider: "another-vendor",
    thoughts: "thought",
    thoughtsTokenCount: 2,
    totalTokens: 15,
    tokensPerSecond: null,
    warnings: [{ type: "unsupported", message: "temperature: Model default used" }],
    sources: [{ url: "https://example.com/source", title: "Source" }],
  });
  expect(second).toEqual({ ...first, fromCache: true });
  expect(requests).toBe(1);
});

test("cached structured values are revalidated and rejected entries are removed", async () => {
  const mock = transport("openai", '{"response":{"value":7}}');
  const base = {
    ...options("openai"),
    fetch: mock.fetch,
    schemaJson: z.toJSONSchema(z.object({ value: z.number() })),
  };
  await askAI("revalidate", base);
  const file = readdirSync(".journalism-cache")[0];
  if (!file) throw new Error("Missing cache entry");
  const path = `.journalism-cache/${file}`;
  const original = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(path, "utf8")));
  writeFileSync(path, JSON.stringify({ ...original, response: { value: "invalid" } }));
  await expect(askAI("revalidate", base)).rejects.toThrow();
  expect(readdirSync(".journalism-cache")).toEqual([]);
  expect((await askAI("revalidate", base)).fromCache).toBe(false);
  expect(mock.requests).toHaveLength(2);
});

test("refusals with no text and invalid schemas cannot become successful cache entries", async () => {
  const mock = transport("openai", "");
  await expect(askAI("refusal", { ...options("openai"), fetch: mock.fetch })).rejects.toThrow();
  await expect(
    askAI("impossible", { ...options("openai"), fetch: mock.fetch, schemaJson: false }),
  ).rejects.toThrow("cannot produce");
  expect(mock.requests).toHaveLength(1);
  expect(readdirSync(".journalism-cache")).toEqual([]);
});

const liveConfigurations: {
  provider: Provider;
  model?: string;
  apiKey?: string;
  project?: string;
  location?: string;
  baseURL?: string;
  configured: boolean;
}[] = [
  {
    provider: "openai",
    model: process.env.OPENAI_MODEL,
    apiKey: process.env.OPENAI_API_KEY,
    configured: Boolean(process.env.OPENAI_MODEL && process.env.OPENAI_API_KEY),
  },
  {
    provider: "anthropic",
    model: process.env.ANTHROPIC_MODEL,
    apiKey: process.env.ANTHROPIC_API_KEY,
    configured: Boolean(process.env.ANTHROPIC_MODEL && process.env.ANTHROPIC_API_KEY),
  },
  {
    provider: "gemini",
    model: process.env.GEMINI_MODEL ?? process.env.AI_MODEL,
    apiKey:
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.AI_KEY,
    configured: Boolean(
      (process.env.GEMINI_MODEL ?? process.env.AI_MODEL) &&
      (process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
        process.env.GEMINI_API_KEY ??
        process.env.AI_KEY),
    ),
  },
  {
    provider: "vertex",
    model: process.env.VERTEX_MODEL ?? process.env.AI_MODEL,
    apiKey: process.env.GOOGLE_VERTEX_API_KEY,
    project: process.env.AI_PROJECT ?? process.env.GOOGLE_VERTEX_PROJECT,
    location: process.env.AI_LOCATION ?? process.env.GOOGLE_VERTEX_LOCATION,
    configured: Boolean(
      (process.env.VERTEX_MODEL ?? process.env.AI_MODEL) &&
      (process.env.GOOGLE_VERTEX_API_KEY ||
        process.env.AI_PROJECT ||
        process.env.GOOGLE_VERTEX_PROJECT),
    ),
  },
  {
    provider: "ollama",
    model: process.env.OLLAMA_MODEL ?? process.env.AI_MODEL,
    baseURL: process.env.OLLAMA_HOST,
    configured: Boolean(
      (process.env.OLLAMA_MODEL ?? process.env.AI_MODEL) &&
      (process.env.OLLAMA_MODEL || process.env.OLLAMA === "true"),
    ),
  },
];

for (const { configured, ...settings } of liveConfigurations) {
  test.skipIf(process.env.CI === "true" || !configured)(
    `live ${settings.provider} generation`,
    async () => {
      const result = await askAI("Reply with the word ready.", {
        ...settings,
        cache: false,
        maxOutputTokens: 1024,
      });
      expect(z.string().parse(result.response).trim().length).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false);
    },
  );
}
