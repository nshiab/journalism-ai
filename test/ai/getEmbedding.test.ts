import { beforeEach, afterEach, test, expect, vi } from "vite-plus/test";
import { rmSync, readdirSync, readFileSync } from "node:fs";
import { getEmbedding } from "../../src/index.ts";
import { embeddingTransport } from "./helpers/embeddingTransport.ts";

type Provider = NonNullable<NonNullable<Parameters<typeof getEmbedding>[1]>["provider"]>;
const providers: Provider[] = ["openai", "gemini", "google-agent-platform", "ollama"];
beforeEach(() => {
  for (const name of [
    "AI_PROVIDER",
    "AI_EMBEDDINGS_PROVIDER",
    "AI_EMBEDDINGS_MODEL",
    "AI_KEY",
    "AI_PROJECT",
    "AI_LOCATION",
    "OLLAMA_HOST",
  ])
    vi.stubEnv(name, undefined);
  rmSync(".journalism-cache", { recursive: true, force: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

for (const provider of providers) {
  test(`${provider} embeds and caches through the shared interface`, async () => {
    const mock = embeddingTransport(provider);
    const options = { provider, model: "embedding-test", apiKey: "test-secret", fetch: mock.fetch };
    expect(await getEmbedding("local reporting", options)).toEqual([1, 2]);
    expect(await getEmbedding("local reporting", options)).toEqual([1, 2]);
    expect(mock.requests).toHaveLength(1);
    expect(await getEmbedding("local reporting", { ...options, cache: false })).toEqual([1, 2]);
    expect(mock.requests).toHaveLength(2);
    const record = readdirSync(".journalism-cache")[0];
    if (!record) throw new Error("Missing cache record");
    expect(readFileSync(`.journalism-cache/${record}`, "utf8")).not.toContain("test-secret");
  });
}

test("embedding configuration overrides generation provider and uses the common key", async () => {
  vi.stubEnv("AI_PROVIDER", "anthropic");
  vi.stubEnv("AI_EMBEDDINGS_PROVIDER", "openai");
  vi.stubEnv("AI_KEY", "common-key");
  vi.stubEnv("AI_EMBEDDINGS_MODEL", "embedding-test");
  const mock = embeddingTransport("openai");
  expect(await getEmbedding("text", { fetch: mock.fetch })).toEqual([1, 2]);
  expect(mock.requests[0]?.headers.get("authorization")).toBe("Bearer common-key");
});

test("Anthropic, missing provider/model and legacy selection are rejected", async () => {
  vi.stubEnv("AI_PROVIDER", "anthropic");
  await expect(getEmbedding("text", { model: "test" })).rejects.toThrow("no native embedding");
  vi.stubEnv("AI_PROVIDER", undefined);
  vi.stubEnv("OLLAMA", "true");
  await expect(getEmbedding("text", { model: "test" })).rejects.toThrow("AI_PROVIDER");
  await expect(getEmbedding("text", { provider: "ollama" })).rejects.toThrow("AI_EMBEDDINGS_MODEL");
});

for (const provider of ["openai", "gemini", "google-agent-platform"] satisfies Provider[]) {
  test(`${provider} forwards dimensions and validates the returned vector length`, async () => {
    const mock = embeddingTransport(provider, [1, 2, 3]);
    const options = {
      provider,
      model: "embedding-test",
      apiKey: "key",
      dimensions: 3,
      fetch: mock.fetch,
    };
    expect(await getEmbedding("text", options)).toEqual([1, 2, 3]);
    expect(JSON.stringify(mock.requests[0]?.body)).toContain(
      provider === "openai" ? '"dimensions":3' : '"outputDimensionality":3',
    );
    await expect(
      getEmbedding("wrong size", { ...options, fetch: embeddingTransport(provider, [1]).fetch }),
    ).rejects.toThrow();
  });
}

test("Ollama forwards its context window and ignores keys", async () => {
  vi.stubEnv("AI_KEY", "irrelevant");
  const mock = embeddingTransport("ollama");
  await getEmbedding("text", {
    provider: "ollama",
    model: "test",
    contextWindow: 8192,
    fetch: mock.fetch,
  });
  expect(mock.requests[0]?.body).toMatchObject({
    model: "test",
    input: ["text"],
    options: { num_ctx: 8192 },
  });
  await expect(
    getEmbedding("text", { provider: "ollama", model: "test", dimensions: 3 }),
  ).rejects.toThrow("dimensions");
  await expect(
    getEmbedding("text", { provider: "gemini", model: "test", contextWindow: 8192 }),
  ).rejects.toThrow("Ollama");
});

for (const vector of [[], [null], [1, "bad"]]) {
  test(`malformed vectors cannot be cached: ${JSON.stringify(vector)}`, async () => {
    const mock = embeddingTransport("ollama", vector);
    await expect(
      getEmbedding("text", { provider: "ollama", model: "test", fetch: mock.fetch }),
    ).rejects.toThrow();
    expect(readdirSync(".journalism-cache")).toEqual([]);
  });
}

const selected = process.env.AI_EMBEDDINGS_PROVIDER ?? process.env.AI_PROVIDER;
const model = process.env.AI_EMBEDDINGS_MODEL;
const key = process.env.AI_KEY;
const project = process.env.AI_PROJECT;
const location = process.env.AI_LOCATION;
const host = process.env.OLLAMA_HOST;
for (const provider of providers) {
  const configured =
    selected === provider &&
    Boolean(model) &&
    (provider === "ollama" ||
      Boolean(key) ||
      (provider === "google-agent-platform" && Boolean(project)));
  test.skipIf(process.env.CI === "true" || !configured)(`live ${provider} embedding`, async () => {
    const result = await getEmbedding("Local reporting matters.", {
      provider,
      model,
      apiKey: key,
      ...(provider === "google-agent-platform" ? { project, location } : {}),
      ...(provider === "ollama" ? { baseURL: host } : {}),
      cache: false,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(Number.isFinite)).toBe(true);
  });
}
