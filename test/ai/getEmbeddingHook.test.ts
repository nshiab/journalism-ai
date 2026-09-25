import { assertEquals, assertRejects } from "jsr:@std/assert";
import getEmbedding from "../../src/ai/getEmbedding.ts";
import {
  getEmbeddingIdentity,
  type GetEmbeddingOptions,
} from "../../src/ai/embeddingOptions.ts";

async function withProvider(
  backend: "ollama" | "gemini-api" | "vertex",
  run: (options: GetEmbeddingOptions, requests: () => number) => Promise<void>,
): Promise<void> {
  const cwd = Deno.cwd();
  const directory = Deno.makeTempDirSync();
  const originalFetch = globalThis.fetch;
  let requests = 0;
  Deno.chdir(directory);
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
  const options: GetEmbeddingOptions = backend === "ollama"
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
      ...(backend === "vertex" ? { vertex: true as const } : {}),
    };
  try {
    await run(options, () => requests);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.chdir(cwd);
    Deno.removeSync(directory, { recursive: true });
  }
}

for (const backend of ["ollama", "gemini-api", "vertex"] as const) {
  for (const cache of [true, false]) {
    Deno.test(`${backend} awaits the request hook with cache=${cache}`, async () => {
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

  Deno.test(`${backend} cache hits skip changed hooks and preserve identity`, async () => {
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

  Deno.test(`${backend} hook failure prevents dispatch and caller retry invokes it again`, async () => {
    await withProvider(backend, async (options, requests) => {
      let hooks = 0;
      const retryable = {
        ...options,
        beforeRequest: () => {
          hooks++;
          return hooks === 1
            ? Promise.reject(new Error("pacing failed"))
            : Promise.resolve();
        },
      };
      await assertRejects(
        () => getEmbedding("text", retryable),
        Error,
        "pacing failed",
      );
      assertEquals(requests(), 0);
      assertEquals(await getEmbedding("text", retryable), [1, 2]);
      assertEquals(hooks, 2);
      assertEquals(requests(), 1);
      assertEquals(await getEmbedding("text", retryable), [1, 2]);
      assertEquals(hooks, 2);
    });
  });
}
