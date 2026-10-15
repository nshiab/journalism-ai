import { test } from "vite-plus/test";
import {
  deepStrictEqual as assertEquals,
  notDeepStrictEqual as assertNotEquals,
  throws as assertThrows,
} from "node:assert/strict";
import { getEmbeddingIdentity } from "../../src/index.ts";
import { Ollama } from "ollama";

test("explicit Gemini API selection ignores ambient Vertex configuration", () => {
  assertEquals(
    getEmbeddingIdentity(
      {
        provider: "gemini",
        model: "shared-model",
        apiKey: "secret",
        cache: true,
        verbose: true,
      },
      {
        AI_EMBEDDINGS_PROVIDER: "ollama",
        AI_PROJECT: "ambient-project",
        AI_LOCATION: "ambient-location",
      },
    ),
    {
      schemaVersion: 2,
      provider: "gemini",
      backend: "gemini-api",
      model: "shared-model",
    },
  );
});

test("Vertex deployment is part of the canonical identity", () => {
  const first = getEmbeddingIdentity({
    provider: "gemini",
    vertex: true,
    model: "shared-model",
    project: "first-project",
    location: "northamerica-northeast1",
  });
  const second = getEmbeddingIdentity({
    provider: "gemini",
    vertex: true,
    model: "shared-model",
    project: "second-project",
    location: "northamerica-northeast1",
  });

  assertEquals(first.backend, "vertex");
  if (first.backend !== "vertex") throw new Error("Expected Vertex identity");
  assertEquals(first.project, "first-project");
  assertEquals(first.location, "northamerica-northeast1");
  assertNotEquals(first, second);
});

test("Ollama endpoint and context window are part of the canonical identity", () => {
  const smallContext = getEmbeddingIdentity({
    provider: "ollama",
    model: "shared-model",
    contextWindow: 2_048,
    ollama: {
      embeddingEndpoint: "http://user:password@first.example:11434/team-a?token=secret",
      embed: () => Promise.resolve({ embeddings: [[1]] }),
    },
  });
  const largeContext = getEmbeddingIdentity({
    provider: "ollama",
    model: "shared-model",
    contextWindow: 32_000,
    ollama: new Ollama({ host: "http://second.example:11434/team-a" }),
  });

  assertEquals(smallContext, {
    schemaVersion: 2,
    provider: "ollama",
    backend: "ollama",
    model: "shared-model",
    endpoint: "http://first.example:11434/team-a",
    contextWindow: 2_048,
  });
  assertNotEquals(smallContext, largeContext);
});

test("custom Ollama adapters require an endpoint identity", () => {
  assertThrows(
    () =>
      getEmbeddingIdentity({
        provider: "ollama",
        model: "shared-model",
        ollama: {
          embed: () => Promise.resolve({ embeddings: [[1]] }),
        },
      }),
    /must provide a non-secret embeddingEndpoint/,
  );
});

test("credentials, logging, and cache controls do not affect identity", () => {
  const first = getEmbeddingIdentity({
    provider: "gemini",
    model: "shared-model",
    apiKey: "first-secret",
    cache: true,
    verbose: true,
  });
  const second = getEmbeddingIdentity({
    provider: "gemini",
    model: "shared-model",
    apiKey: "second-secret",
    cache: false,
    verbose: false,
  });

  assertEquals(first, second);
});

test("environment-selected identity resolves provider, backend, and model", () => {
  assertEquals(
    getEmbeddingIdentity(
      {},
      {
        AI_EMBEDDINGS_PROVIDER: "gemini",
        AI_EMBEDDINGS_MODEL: "environment-model",
        AI_PROJECT: "environment-project",
        AI_LOCATION: "environment-location",
      },
    ),
    {
      schemaVersion: 2,
      provider: "gemini",
      backend: "vertex",
      model: "environment-model",
      project: "environment-project",
      location: "environment-location",
    },
  );
});

test("legacy boolean Ollama selection remains runtime-compatible", () => {
  const legacyOptions = {
    model: "legacy-model",
    ollama: true,
  };

  assertEquals(Reflect.apply(getEmbeddingIdentity, undefined, [legacyOptions, {}]), {
    schemaVersion: 2,
    provider: "ollama",
    backend: "ollama",
    model: "legacy-model",
    endpoint: "http://127.0.0.1:11434",
  });
});
