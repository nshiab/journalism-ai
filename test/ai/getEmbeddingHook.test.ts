import { test } from "vite-plus/test";
import { rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepStrictEqual as assertEquals, rejects as assertRejects } from "node:assert/strict";
import getEmbedding from "../../src/ai/getEmbedding.ts";
import { getEmbeddingIdentity, type GetEmbeddingOptions } from "../../src/ai/embeddingOptions.ts";

async function withProvider(
  backend: "ollama" | "gemini-api" | "vertex",
  run: (options: GetEmbeddingOptions, requests: () => number) => Promise<void>,
): Promise<void> {
  const cwd = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "journalism-ai-"));
  const originalFetch = globalThis.fetch;
  let requests = 0;
  process.chdir(directory);
  globalThis.fetch = () => {
    requests++;
    return Promise.resolve(
      Response.json(
        backend === "vertex"
          ? { predictions: [{ embeddings: { values: [1, 2] } }] }
          : { embeddings: [{ values: [1, 2] }] },
      ),
    );
  };
  const options: GetEmbeddingOptions =
    backend === "ollama"
      ? {
          provider: "ollama",
          model: "hook-test",
          ollama: {
            embeddingEndpoint: "http://hook-test.local:11434",
            embed: () => {
              requests++;
              return Promise.resolve({ embeddings: [[1, 2]] });
            },
          },
        }
      : {
          provider: "gemini",
          model: "hook-test",
          apiKey: "fake-key",
          ...(backend === "vertex" ? { vertex: true } : {}),
        };
  try {
    await run(options, () => requests);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    rmSync(directory, { recursive: true });
  }
}

const backends: ("ollama" | "gemini-api" | "vertex")[] = ["ollama", "gemini-api", "vertex"];
for (const backend of backends) {
  for (const cache of [true, false]) {
    test(`${backend} awaits the request hook with cache=${cache}`, async () => {
      await withProvider(backend, async (options, requests) => {
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const pending = getEmbedding("text", {
          ...options,
          cache,
          beforeRequest: async () => {
            entered.resolve();
            await release.promise;
          },
        });
        try {
          await entered.promise;
          assertEquals(requests(), 0);
        } finally {
          release.resolve();
        }
        assertEquals(await pending, [1, 2]);
        assertEquals(requests(), 1);
      });
    });
  }

  test(`${backend} cache hits skip changed hooks and preserve identity`, async () => {
    await withProvider(backend, async (options, requests) => {
      let hooks = 0;
      const first = {
        ...options,
        beforeRequest: () => {
          hooks++;
        },
      };
      const second = {
        ...options,
        beforeRequest: () => {
          throw new Error("cache hit called hook");
        },
      };
      assertEquals(getEmbeddingIdentity(first), getEmbeddingIdentity(second));
      assertEquals(await getEmbedding("text", first), [1, 2]);
      assertEquals(await getEmbedding("text", second), [1, 2]);
      assertEquals(await getEmbedding("text", options), [1, 2]);
      assertEquals(hooks, 1);
      assertEquals(requests(), 1);
    });
  });

  test(`${backend} hook failure prevents dispatch and caller retry invokes it again`, async () => {
    await withProvider(backend, async (options, requests) => {
      let hooks = 0;
      const retryable = {
        ...options,
        beforeRequest: () => {
          hooks++;
          return hooks === 1 ? Promise.reject(new Error("pacing failed")) : Promise.resolve();
        },
      };
      await assertRejects(() => getEmbedding("text", retryable), /pacing failed/);
      assertEquals(requests(), 0);
      assertEquals(await getEmbedding("text", retryable), [1, 2]);
      assertEquals(hooks, 2);
      assertEquals(requests(), 1);
      assertEquals(await getEmbedding("text", retryable), [1, 2]);
      assertEquals(hooks, 2);
    });
  });
}
