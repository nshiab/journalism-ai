import { expect, test } from "vite-plus/test";
import { getEmbeddingIdentity } from "../../src/index.ts";

test("identity resolves explicit configuration and excludes credentials, logging and pacing", () => {
  const options = { provider: "openai", model: "test", dimensions: 2 } satisfies NonNullable<
    Parameters<typeof getEmbeddingIdentity>[0]
  >;
  const first = getEmbeddingIdentity(
    { ...options, apiKey: "secret", beforeRequest: () => undefined, cache: true },
    {},
  );
  const second = getEmbeddingIdentity(
    { ...options, apiKey: "rotated", verbose: true, cache: false, maxRetries: 2 },
    {},
  );
  expect(first).toEqual(second);
  expect(first.schemaVersion).toBe(3);
  expect(JSON.stringify(first)).not.toContain("secret");
});

test("providers, dimensions, endpoints and semantic options isolate vector spaces", () => {
  const base = { provider: "openai", model: "same-model" } satisfies NonNullable<
    Parameters<typeof getEmbeddingIdentity>[0]
  >;
  const identity = getEmbeddingIdentity(base, {});
  for (const options of [
    { ...base, provider: "gemini" },
    { ...base, model: "other-model" },
    { ...base, dimensions: 3 },
    { ...base, baseURL: "https://other.example/v1" },
    { ...base, providerOptions: { openai: { dimensions: 3 } } },
  ] satisfies NonNullable<Parameters<typeof getEmbeddingIdentity>[0]>[])
    expect(getEmbeddingIdentity(options, {})).not.toEqual(identity);
  const direct = getEmbeddingIdentity({ provider: "gemini", model: "same-model" }, {});
  const cloud = getEmbeddingIdentity(
    {
      provider: "google-agent-platform",
      model: "same-model",
      project: "project-a",
      location: "global",
    },
    {},
  );
  expect(cloud).not.toEqual(direct);
  expect(
    getEmbeddingIdentity(
      {
        provider: "google-agent-platform",
        model: "same-model",
        project: "project-b",
        location: "global",
      },
      {},
    ),
  ).not.toEqual(cloud);
});

test("Ollama keys are ignored while host and context affect identity", () => {
  const base = { provider: "ollama", model: "test" } satisfies NonNullable<
    Parameters<typeof getEmbeddingIdentity>[0]
  >;
  const first = getEmbeddingIdentity(base, {
    AI_KEY: "one",
    OLLAMA_HOST: "http://first.example:11434",
  });
  expect(
    getEmbeddingIdentity(
      { ...base, apiKey: "two" },
      { OLLAMA_HOST: "http://first.example:11434/" },
    ),
  ).toEqual(first);
  expect(getEmbeddingIdentity(base, { OLLAMA_HOST: "http://second.example:11434" })).not.toEqual(
    first,
  );
  expect(
    getEmbeddingIdentity(
      { ...base, contextWindow: 8192 },
      { OLLAMA_HOST: "http://first.example:11434" },
    ),
  ).not.toEqual(first);
});

test("environment resolution is explicit and validates incompatible settings", () => {
  expect(
    getEmbeddingIdentity({}, { AI_PROVIDER: "gemini", AI_EMBEDDINGS_MODEL: "test" }).provider,
  ).toBe("gemini");
  expect(
    getEmbeddingIdentity(
      {},
      { AI_PROVIDER: "anthropic", AI_EMBEDDINGS_PROVIDER: "ollama", AI_EMBEDDINGS_MODEL: "test" },
    ).provider,
  ).toBe("ollama");
  expect(() => getEmbeddingIdentity({}, { AI_EMBEDDINGS_MODEL: "test", AI_KEY: "key" })).toThrow(
    "AI_PROVIDER",
  );
  expect(() =>
    getEmbeddingIdentity(
      { provider: "openai", model: "test", baseURL: "https://user:secret@example.com" },
      {},
    ),
  ).toThrow("baseURL");
  expect(() =>
    getEmbeddingIdentity(
      {
        provider: "openai",
        model: "test",
        dimensions: 3,
        providerOptions: { openai: { dimensions: 2 } },
      },
      {},
    ),
  ).toThrow("conflicts");
});
