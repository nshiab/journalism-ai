import type { GetEmbeddingOptions } from "../../src/ai/embeddingOptions.ts";
import { z } from "zod";
import { test } from "vite-plus/test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import getEmbedding from "../../src/ai/getEmbedding.ts";
import { Ollama } from "ollama";

const CACHE_PATH = "./.journalism-cache";

function cacheFiles(): Set<string> {
  return new Set(existsSync(CACHE_PATH) ? readdirSync(CACHE_PATH) : []);
}

function removeAddedCacheFiles(previousFiles: Set<string>): void {
  if (!existsSync(CACHE_PATH)) return;
  for (const file of readdirSync(CACHE_PATH)) {
    if (!previousFiles.has(file)) {
      unlinkSync(`${CACHE_PATH}/${file}`);
    }
  }
}

test("cache entries are isolated by resolved provider identity", async () => {
  const previousCacheFiles = cacheFiles();
  const originalFetch = globalThis.fetch;
  const model = `shared-model-${crypto.randomUUID()}`;
  const text = `shared-text-${crypto.randomUUID()}`;
  let geminiRequests = 0;
  let vertexRequests = 0;
  let ollamaRequests = 0;

  globalThis.fetch = (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      geminiRequests++;
      return Promise.resolve(
        Response.json({
          embeddings: [{ values: [1] }],
        }),
      );
    }
    if (url.includes("aiplatform.googleapis.com")) {
      vertexRequests++;
      return Promise.resolve(
        Response.json({
          predictions: [{ embeddings: { values: [2] } }],
        }),
      );
    }
    throw new Error(`Unexpected fake request: ${url}`);
  };

  const fakeOllama = new Ollama({
    host: "http://fake-ollama.example:11434",
    fetch: () => {
      ollamaRequests++;
      return Promise.resolve(Response.json({ embeddings: [[3]] }));
    },
  });

  try {
    const geminiOptions: GetEmbeddingOptions = {
      provider: "gemini",
      model,
      apiKey: "fake-gemini-key",
      cache: true,
    };
    const vertexOptions: GetEmbeddingOptions = {
      provider: "gemini",
      vertex: true,
      model,
      apiKey: "fake-vertex-key",
      cache: true,
    };
    const ollamaOptions: GetEmbeddingOptions = {
      provider: "ollama",
      model,
      ollama: fakeOllama,
      cache: true,
    };

    assertEquals(await getEmbedding(text, geminiOptions), [1]);
    assertEquals(await getEmbedding(text, vertexOptions), [2]);
    assertEquals(await getEmbedding(text, ollamaOptions), [3]);
    assertEquals(await getEmbedding(text, geminiOptions), [1]);
    assertEquals(await getEmbedding(text, vertexOptions), [2]);
    assertEquals(await getEmbedding(text, ollamaOptions), [3]);
    assertEquals(
      { geminiRequests, vertexRequests, ollamaRequests },
      { geminiRequests: 1, vertexRequests: 1, ollamaRequests: 1 },
    );
  } finally {
    globalThis.fetch = originalFetch;
    removeAddedCacheFiles(previousCacheFiles);
  }
});

test("Ollama endpoint and context window isolate cache entries", async () => {
  const previousCacheFiles = cacheFiles();
  const model = `ollama-model-${crypto.randomUUID()}`;
  const text = `ollama-text-${crypto.randomUUID()}`;
  let firstEndpointRequests = 0;
  let secondEndpointRequests = 0;

  const firstEndpoint = new Ollama({
    host: "http://first-ollama.example:11434",
    fetch: (_input, init) => {
      firstEndpointRequests++;
      if (typeof init?.body !== "string") throw new Error("Expected JSON request body");
      const body = z
        .object({ options: z.object({ num_ctx: z.number() }) })
        .parse(JSON.parse(init.body));
      return Promise.resolve(
        Response.json({
          embeddings: [[body.options.num_ctx]],
        }),
      );
    },
  });
  const secondEndpoint = new Ollama({
    host: "http://second-ollama.example:11434",
    fetch: () => {
      secondEndpointRequests++;
      return Promise.resolve(Response.json({ embeddings: [[32_000]] }));
    },
  });

  try {
    const smallContext: GetEmbeddingOptions = {
      provider: "ollama",
      model,
      ollama: firstEndpoint,
      contextWindow: 2_048,
      cache: true,
    };
    const largeContext = {
      ...smallContext,
      contextWindow: 32_000,
    };
    const secondDeployment = {
      ...largeContext,
      ollama: secondEndpoint,
    };

    assertEquals(await getEmbedding(text, smallContext), [2_048]);
    assertEquals(await getEmbedding(text, largeContext), [32_000]);
    assertEquals(await getEmbedding(text, secondDeployment), [32_000]);
    assertEquals(await getEmbedding(text, smallContext), [2_048]);
    assertEquals(await getEmbedding(text, largeContext), [32_000]);
    assertEquals(await getEmbedding(text, secondDeployment), [32_000]);
    assertEquals(firstEndpointRequests, 2);
    assertEquals(secondEndpointRequests, 1);
  } finally {
    removeAddedCacheFiles(previousCacheFiles);
  }
});

test("cache entries from old schemas are ignored", async () => {
  const previousCacheFiles = cacheFiles();
  const model = `migration-model-${crypto.randomUUID()}`;
  const text = `migration-text-${crypto.randomUUID()}`;
  const legacyHash = createHash("sha256").update(JSON.stringify({ text, model })).digest("hex");
  mkdirSync(CACHE_PATH, { recursive: true });
  writeFileSync(`${CACHE_PATH}/getEmbedding-${legacyHash}.json`, JSON.stringify([99]));
  const partialProviderAwareHash = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "ollama",
        text,
        model,
        contextWindow: undefined,
      }),
    )
    .digest("hex");
  writeFileSync(
    `${CACHE_PATH}/getEmbedding-${partialProviderAwareHash}.json`,
    JSON.stringify([98]),
  );
  let providerRequests = 0;
  const fakeOllama = new Ollama({
    host: "http://migration-ollama.example:11434",
    fetch: () => {
      providerRequests++;
      return Promise.resolve(Response.json({ embeddings: [[4]] }));
    },
  });

  try {
    assertEquals(
      await getEmbedding(text, {
        provider: "ollama",
        model,
        ollama: fakeOllama,
        cache: true,
      }),
      [4],
    );
    assertEquals(providerRequests, 1);
  } finally {
    removeAddedCacheFiles(previousCacheFiles);
  }
});
