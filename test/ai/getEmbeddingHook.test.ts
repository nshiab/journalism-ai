import { beforeEach, afterEach, expect, test, vi } from "vite-plus/test";
import { rmSync } from "node:fs";
import { getEmbedding, getEmbeddingIdentity } from "../../src/index.ts";
import { embeddingTransport } from "./helpers/embeddingTransport.ts";

beforeEach(() => rmSync(".journalism-cache", { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());
for (const provider of [
  "openai",
  "gemini",
  "google-agent-platform",
  "ollama",
] satisfies NonNullable<NonNullable<Parameters<typeof getEmbedding>[1]>["provider"]>[]) {
  for (const cache of [true, false]) {
    test(`${provider} awaits pacing before dispatch with cache=${cache}`, async () => {
      const mock = embeddingTransport(provider);
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const pending = getEmbedding("text", {
        provider,
        model: "test",
        apiKey: "key",
        fetch: mock.fetch,
        cache,
        beforeRequest: async () => {
          entered.resolve();
          await release.promise;
        },
      });
      await entered.promise;
      expect(mock.requests).toHaveLength(0);
      release.resolve();
      expect(await pending).toEqual([1, 2]);
      expect(mock.requests).toHaveLength(1);
    });
  }
  test(`${provider} skips hooks on cache hits and retries hook failures`, async () => {
    const mock = embeddingTransport(provider);
    let calls = 0;
    const options = { provider, model: "test", apiKey: "key", fetch: mock.fetch };
    const beforeRequest = () => {
      if (++calls === 1) throw new Error("pacing failed");
    };
    expect(getEmbeddingIdentity({ ...options, beforeRequest })).toEqual(
      getEmbeddingIdentity(options),
    );
    await expect(getEmbedding("text", { ...options, beforeRequest })).rejects.toThrow(
      "pacing failed",
    );
    expect(mock.requests).toHaveLength(0);
    await getEmbedding("text", { ...options, beforeRequest });
    await getEmbedding("text", {
      ...options,
      beforeRequest: () => {
        throw new Error("cache hit invoked hook");
      },
    });
    expect(calls).toBe(2);
    expect(mock.requests).toHaveLength(1);
  });
}
