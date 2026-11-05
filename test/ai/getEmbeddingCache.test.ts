import { beforeEach, afterEach, expect, test, vi } from "vite-plus/test";
import { mkdirSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { getEmbedding } from "../../src/index.ts";
import { embeddingTransport } from "./helpers/embeddingTransport.ts";

beforeEach(() => {
  vi.stubEnv("AI_KEY", undefined);
  rmSync(".journalism-cache", { recursive: true, force: true });
});
afterEach(() => vi.unstubAllEnvs());

test("different providers and model settings never share cached vectors", async () => {
  for (const provider of [
    "openai",
    "gemini",
    "google-agent-platform",
    "ollama",
  ] satisfies NonNullable<NonNullable<Parameters<typeof getEmbedding>[1]>["provider"]>[]) {
    const mock = embeddingTransport(provider);
    const options = { provider, model: "shared-label", apiKey: "key", fetch: mock.fetch };
    await getEmbedding("same text", options);
    await getEmbedding("same text", options);
    await getEmbedding("same text", { ...options, baseURL: "https://other.example/v1" });
    expect(mock.requests).toHaveLength(2);
  }
  expect(readdirSync(".journalism-cache")).toHaveLength(8);
});

test("v2 vectors are ignored and invalid v3 cache entries are removed", async () => {
  mkdirSync(".journalism-cache");
  writeFileSync(".journalism-cache/getEmbedding-v2-old.json", JSON.stringify([99]));
  const mock = embeddingTransport("ollama");
  const options = { provider: "ollama", model: "test", fetch: mock.fetch } satisfies NonNullable<
    Parameters<typeof getEmbedding>[1]
  >;
  expect(await getEmbedding("text", options)).toEqual([1, 2]);
  const file = readdirSync(".journalism-cache").find((name) => name.startsWith("getEmbedding-v3-"));
  if (!file) throw new Error("Missing v3 cache");
  writeFileSync(`.journalism-cache/${file}`, JSON.stringify({ response: [1, "invalid"] }));
  await expect(getEmbedding("text", options)).rejects.toThrow();
  expect(await getEmbedding("text", options)).toEqual([1, 2]);
  expect(mock.requests).toHaveLength(2);
});
