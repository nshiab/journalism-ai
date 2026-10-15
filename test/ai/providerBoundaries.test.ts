import { afterEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { Ollama } from "ollama";
import { z } from "zod";
import { askGemini, askOllama, getEmbedding } from "../../src/index.ts";

const geminiOptions = { apiKey: "test-key", model: "gemini-3.5-flash", cache: false };
const geminiPayload = {
  candidates: [
    {
      content: {
        role: "model",
        parts: [{ text: "reason", thought: true }, { text: '{"value":7}' }],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 20,
    thoughtsTokenCount: 30,
    totalTokenCount: 60,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockGemini(payload: unknown = geminiPayload) {
  const requests: unknown[] = [];
  vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
    if (typeof init?.body !== "string") throw new Error("Expected JSON provider request");
    const body: unknown = JSON.parse(init.body);
    requests.push(body);
    return Promise.resolve(Response.json(payload));
  });
  return requests;
}

function fakeOllama(content: string, requests: unknown[]) {
  return new Ollama({
    host: "http://offline.example:11434",
    fetch: (_input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected JSON provider request");
      const body: unknown = JSON.parse(init.body);
      requests.push(body);
      return Promise.resolve(
        Response.json({
          message: { role: "assistant", content, thinking: "thought" },
          prompt_eval_count: 2,
          eval_count: 3,
        }),
      );
    },
  });
}

test("Gemini forwards request controls and retains token, thought, and cost accounting", async () => {
  const requests = mockGemini();
  const schemaJson = z.toJSONSchema(z.object({ value: z.number() }));
  const result = await askGemini("question", {
    ...geminiOptions,
    systemPrompt: "system",
    schemaJson,
    thinkingLevel: "high",
    safetyEnabled: false,
    temperature: 0.4,
    webSearch: true,
    processResponse: (response) => z.object({ value: z.number() }).parse(response),
  });
  expectTypeOf(result.response).toEqualTypeOf<{ value: number }>();
  expect(result).toMatchObject({
    response: { value: 7 },
    thoughts: "reason",
    promptTokenCount: 10,
    outputTokenCount: 20,
    thoughtsTokenCount: 30,
    totalTokens: 60,
    fromCache: false,
    estimatedCost: 0.000465,
  });
  expect(requests).toHaveLength(1);
  const { safetySettings } = z
    .object({ safetySettings: z.array(z.object({ threshold: z.string() })) })
    .parse(requests[0]);
  expect(safetySettings).toHaveLength(5);
  expect(safetySettings.every((setting) => setting.threshold === "BLOCK_NONE")).toBe(true);
  expect(requests[0]).toMatchObject({
    systemInstruction: { parts: [{ text: "system" }] },
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseJsonSchema: schemaJson,
      thinkingConfig: { thinkingLevel: "HIGH", includeThoughts: true },
    },
    tools: [{ googleSearch: {} }],
  });
});

test("Gemini appends local and GCS files in input order and merges SDK overrides", async () => {
  const requests = mockGemini();
  writeFileSync("article.txt", "local article");
  writeFileSync("photo.jpg", "image bytes");
  await askGemini("question", {
    ...geminiOptions,
    files: [
      { path: "article.txt", type: "text" },
      { path: "photo.jpg", type: "image" },
      { path: "gs://bucket/file.pdf", type: "pdf" },
      { path: "gs://bucket/article.txt", type: "text" },
    ],
    geminiParameters: { config: { temperature: 0.7, maxOutputTokens: 123 } },
  });
  expect(requests[0]).toMatchObject({
    contents: [
      {
        parts: [
          { text: "question" },
          { text: "local article" },
          {
            inlineData: {
              data: Buffer.from("image bytes").toString("base64"),
              mimeType: "image/jpeg",
            },
          },
          { fileData: { fileUri: "gs://bucket/file.pdf", mimeType: "application/pdf" } },
          { fileData: { fileUri: "gs://bucket/article.txt", mimeType: "text/plain" } },
        ],
      },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 123 },
  });
});

test("Gemini propagates provider errors without caching a failed request", async () => {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      Response.json(
        { error: { code: 400, message: "invalid provider request", status: "INVALID_ARGUMENT" } },
        { status: 400 },
      ),
    ),
  );
  await expect(askGemini("failed", { ...geminiOptions, cache: true })).rejects.toThrow(
    "invalid provider request",
  );
});

test("Gemini cached responses retain null rates and raw data for changed async processors", async () => {
  const requests = mockGemini();
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const options = { ...geminiOptions, cache: true, schemaJson: { type: "object" } };
  await askGemini("cache metadata", options);
  const result = await askGemini("cache metadata", {
    ...options,
    processResponse: async (value) => z.object({ value: z.number() }).parse(value).value * 2,
  });
  expectTypeOf(result.response).toEqualTypeOf<number>();
  expect(result).toMatchObject({
    response: 14,
    fromCache: true,
    tokensPerSecond: null,
    thoughts: "reason",
    totalTokens: 60,
    durationMs: 0,
  });
  expect(requests).toHaveLength(1);
});

test("Gemini removes processor-rejected cache entries and fetches again on caller retry", async () => {
  const requests = mockGemini();
  const options = { ...geminiOptions, cache: true };
  await askGemini("invalidate cache", options);
  await expect(
    askGemini("invalidate cache", {
      ...options,
      processResponse: () => {
        throw new Error("rejected");
      },
    }),
  ).rejects.toThrow("rejected");
  const result = await askGemini("invalidate cache", options);
  expect(result.fromCache).toBe(false);
  expect(requests).toHaveLength(2);
});

test("Ollama retains file order, reasoning, context, SDK overrides, and processor inference", async () => {
  const requests: unknown[] = [];
  writeFileSync("ollama-article.txt", "article text");
  writeFileSync("ollama-photo.jpg", "photo bytes");
  const result = await askOllama("question", {
    model: "test-model",
    cache: false,
    ollama: fakeOllama('{"value":7}', requests),
    schemaJson: z.toJSONSchema(z.object({ value: z.number() })),
    systemPrompt: "system",
    thinkingLevel: "low",
    contextWindow: 8192,
    temperature: 0.3,
    files: [
      { path: "ollama-article.txt", type: "text" },
      { path: "ollama-photo.jpg", type: "image" },
    ],
    ollamaParameters: { keep_alive: "5m", stream: true },
    processResponse: async (response) => z.object({ value: z.number() }).parse(response),
  });
  expectTypeOf(result.response).toEqualTypeOf<{ value: number }>();
  expect(result).toMatchObject({
    response: { value: 7 },
    thoughts: "thought",
    promptTokenCount: 2,
    outputTokenCount: 3,
    totalTokens: 5,
  });
  expect(requests[0]).toMatchObject({
    stream: false,
    think: "low",
    keep_alive: "5m",
    options: { temperature: 0.3, num_ctx: 8192 },
    messages: [
      { role: "system", content: "system" },
      { role: "user", images: [Buffer.from("photo bytes").toString("base64")] },
      { role: "user", content: "Content from ollama-article.txt:\narticle text" },
    ],
  });
});

for (const schemaJson of [true, false]) {
  test(`Ollama preserves boolean JSON schema ${schemaJson} validation`, async () => {
    const requests: unknown[] = [];
    const result = askOllama("boolean schema", {
      model: "test-model",
      cache: false,
      ollama: fakeOllama('"value"', requests),
      schemaJson,
    });
    if (schemaJson) expect((await result).response).toBe("value");
    else await expect(result).rejects.toThrow();
    expect(requests[0]).toMatchObject({ format: schemaJson ? {} : { not: {} } });
  });
}

test("Ollama preserves cached metadata and invalidates schema-rejected cached responses", async () => {
  const requests: unknown[] = [];
  const options = {
    model: "test-model",
    ollama: fakeOllama('{"value":7}', requests),
    schemaJson: z.toJSONSchema(z.object({ value: z.number() })),
  };
  vi.spyOn(Date, "now").mockReturnValue(1000);
  await askOllama("cached schema", options);
  const cached = await askOllama("cached schema", {
    ...options,
    processResponse: (response) => z.object({ value: z.number() }).parse(response).value,
  });
  expect(cached).toMatchObject({
    response: 7,
    fromCache: true,
    tokensPerSecond: null,
    totalTokens: 5,
  });
  const files = readdirSync(".journalism-cache");
  const file = files.find((name) =>
    readFileSync(`.journalism-cache/${name}`, "utf8").includes('"prompt":"cached schema"'),
  );
  if (!file) throw new Error("Cache file missing");
  const value = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(`.journalism-cache/${file}`, "utf8")));
  writeFileSync(
    `.journalism-cache/${file}`,
    JSON.stringify({ ...value, response: { value: "invalid" } }),
  );
  await expect(askOllama("cached schema", options)).rejects.toThrow();
  expect((await askOllama("cached schema", options)).fromCache).toBe(false);
  expect(requests).toHaveLength(2);
});

for (const embeddings of [[], [[]], [[1, "bad"]]]) {
  test(`rejects malformed Ollama embedding ${JSON.stringify(embeddings)}`, async () => {
    const client = new Ollama({
      host: "http://offline.example:11434",
      fetch: () => Promise.resolve(Response.json({ embeddings })),
    });
    await expect(
      getEmbedding("text", {
        provider: "ollama",
        model: "test-model",
        cache: false,
        ollama: client,
      }),
    ).rejects.toThrow("Invalid response from the API");
  });
}

test("malformed cached Gemini metadata is rejected and removed before caller retry", async () => {
  const requests = mockGemini();
  const options = { ...geminiOptions, cache: true };
  await askGemini("invalid metadata", options);
  const file = readdirSync(".journalism-cache").find((name) =>
    readFileSync(`.journalism-cache/${name}`, "utf8").includes('"prompt":"invalid metadata"'),
  );
  if (!file) throw new Error("Cache file missing");
  const cached = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(`.journalism-cache/${file}`, "utf8")));
  writeFileSync(`.journalism-cache/${file}`, JSON.stringify({ ...cached, totalTokens: "invalid" }));
  await expect(askGemini("invalid metadata", options)).rejects.toThrow();
  expect(requests).toHaveLength(1);
  expect((await askGemini("invalid metadata", options)).fromCache).toBe(false);
  expect(requests).toHaveLength(2);
});

test("cached embeddings validate every vector element before returning", async () => {
  const requests: unknown[] = [];
  const options = {
    provider: "ollama",
    model: "invalid-cache",
    ollama: {
      embeddingEndpoint: "http://offline.example:11434",
      embed: () => {
        requests.push("embed");
        return Promise.resolve({ embeddings: [[1, 2]] });
      },
    },
  } satisfies NonNullable<Parameters<typeof getEmbedding>[1]>;
  await getEmbedding("invalid cached vector", options);
  const file = readdirSync(".journalism-cache").find((name) => name.startsWith("getEmbedding-v2-"));
  if (!file) throw new Error("Embedding cache file missing");
  writeFileSync(`.journalism-cache/${file}`, JSON.stringify([1, "invalid"]));
  await expect(getEmbedding("invalid cached vector", options)).rejects.toThrow(
    "Invalid cached embedding",
  );
  expect(requests).toHaveLength(1);
});
