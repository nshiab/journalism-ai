import { assertEquals, assertThrows } from "jsr:@std/assert";
import resolveEmbeddingProvider from "../../../src/ai/helpers/resolveEmbeddingProvider.ts";
import { getEmbeddingCacheParams } from "../../../src/ai/getEmbedding.ts";

Deno.test("defaults to Gemini", () => {
  assertEquals(resolveEmbeddingProvider({}, {}), "gemini");
});

Deno.test("uses the legacy OLLAMA environment variable", () => {
  assertEquals(resolveEmbeddingProvider({}, { OLLAMA: "true" }), "ollama");
});

Deno.test("uses AI_EMBEDDINGS_PROVIDER before the OLLAMA fallback", () => {
  assertEquals(
    resolveEmbeddingProvider({}, {
      AI_EMBEDDINGS_PROVIDER: "gemini",
      OLLAMA: "true",
    }),
    "gemini",
  );
});

Deno.test("uses an explicit provider before environment variables", () => {
  assertEquals(
    resolveEmbeddingProvider(
      { provider: "ollama" },
      { AI_EMBEDDINGS_PROVIDER: "gemini" },
    ),
    "ollama",
  );
});

Deno.test("keeps explicit ollama booleans compatible", () => {
  assertEquals(resolveEmbeddingProvider({ ollama: true }, {}), "ollama");
  assertEquals(
    resolveEmbeddingProvider({ ollama: false }, { OLLAMA: "true" }),
    "gemini",
  );
});

Deno.test("rejects an invalid environment provider", () => {
  assertThrows(
    () => resolveEmbeddingProvider({}, { AI_EMBEDDINGS_PROVIDER: "other" }),
    Error,
    'AI_EMBEDDINGS_PROVIDER must be either "gemini" or "ollama".',
  );
});

Deno.test("isolates cached embeddings by Ollama context window", () => {
  const smallContext = getEmbeddingCacheParams(
    "text",
    "model",
    "ollama",
    2_048,
  );
  const largeContext = getEmbeddingCacheParams(
    "text",
    "model",
    "ollama",
    32_000,
  );

  assertEquals(
    JSON.stringify(smallContext) === JSON.stringify(largeContext),
    false,
  );
});
