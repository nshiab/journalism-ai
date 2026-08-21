import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import {
  type GeminiEmbeddingOptions,
  getEmbedding,
  type VertexEmbeddingOptions,
} from "../../src/index.ts";
import { existsSync, rmSync } from "node:fs";
import { Ollama } from "ollama";

function inTemporaryDirectory(
  run: (temporaryDirectory: string) => Promise<void>,
): Promise<void> {
  const originalDirectory = Deno.cwd();
  const temporaryDirectory = Deno.makeTempDirSync();
  Deno.chdir(temporaryDirectory);

  return run(temporaryDirectory).finally(() => {
    Deno.chdir(originalDirectory);
    rmSync(temporaryDirectory, { recursive: true });
  });
}

Deno.test("caches embeddings by default and supports opting out", async () => {
  await inTemporaryDirectory(async (temporaryDirectory) => {
    let requests = 0;
    const client = {
      embeddingEndpoint: "http://test-ollama.example:11434",
      embed: () => {
        requests++;
        return Promise.resolve({ embeddings: [[requests]] });
      },
    };
    const options = {
      provider: "ollama" as const,
      model: "test-model",
      ollama: client,
    };

    const first = await getEmbedding("default cache", options);
    const second = await getEmbedding("default cache", options);
    const uncachedFirst = await getEmbedding("disabled cache", {
      ...options,
      cache: false,
    });
    const uncachedSecond = await getEmbedding("disabled cache", {
      ...options,
      cache: false,
    });

    assertEquals(first, [1]);
    assertEquals(second, [1]);
    assertEquals(uncachedFirst, [2]);
    assertEquals(uncachedSecond, [3]);
    assertEquals(requests, 3);
    assertEquals(existsSync(`${temporaryDirectory}/.journalism-cache`), true);
  });
});

const aiKey = Deno.env.get("AI_KEY");
const aiProject = Deno.env.get("AI_PROJECT");
const aiLocation = Deno.env.get("AI_LOCATION");
const embeddingModel = Deno.env.get("AI_EMBEDDINGS_MODEL");
const embeddingsProvider = Deno.env.get("AI_EMBEDDINGS_PROVIDER");
const legacyOllama = Deno.env.get("OLLAMA");
const hasGeminiApiCredentials = Boolean(aiKey);
const hasVertexCredentials = Boolean(aiProject) && Boolean(aiLocation);
const hasGoogleCredentials = hasGeminiApiCredentials || hasVertexCredentials;
const hasEmbeddingModel = Boolean(embeddingModel);
const hasOllama = embeddingsProvider === "ollama" || Boolean(legacyOllama);
const environmentProvider = embeddingsProvider ??
  (legacyOllama ? "ollama" : "gemini");

function registerGoogleIntegrationTests(
  backend: string,
  googleOptions: GeminiEmbeddingOptions | VertexEmbeddingOptions,
): void {
  Deno.test(`should create an embedding (${backend})`, async () => {
    const result = await getEmbedding("What is the capital of France?", {
      ...googleOptions,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test(`should create an embedding with verbose option (${backend})`, async () => {
    const result = await getEmbedding("What is the capital of France?", {
      ...googleOptions,
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test(`should create an embedding with verbose option and cache (${backend})`, async () => {
    const result = await getEmbedding("What is the capital of France?", {
      ...googleOptions,
      verbose: true,
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test(`should retrieve an embedding from cache (${backend})`, async () => {
    const result = await getEmbedding("What is the capital of France?", {
      ...googleOptions,
      verbose: true,
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
}

if (hasEmbeddingModel && hasGeminiApiCredentials) {
  registerGoogleIntegrationTests("Gemini API", { provider: "gemini" });
}
if (hasEmbeddingModel && hasVertexCredentials) {
  registerGoogleIntegrationTests("Vertex AI", {
    provider: "gemini",
    vertex: true,
  });
}
if (!hasEmbeddingModel || !hasGoogleCredentials) {
  console.log(
    "No Gemini/Vertex credentials or AI_EMBEDDINGS_MODEL in process.env",
  );
}

if (hasEmbeddingModel && hasOllama) {
  Deno.test("should create an embedding (ollama)", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "ollama",
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create without a specific context window", async () => {
    const result = await getEmbedding(
      "This website is a free, open-source online course on data analysis and visualization using TypeScript. It’s available in English and French. I assume you know nothing about data or code, and I guide you step by step until you’re ready to take off on your own.",
      { provider: "ollama" },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create with a specific context window", async () => {
    const result = await getEmbedding(
      "This website is a free, open-source online course on data analysis and visualization using TypeScript. It’s available in English and French. I assume you know nothing about data or code, and I guide you step by step until you’re ready to take off on your own.",
      { provider: "ollama", contextWindow: 32000 },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create an embedding with a different Ollama instance (ollama)", async () => {
    const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

    const result = await getEmbedding("What is the capital of France?", {
      provider: "ollama",
      ollama,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create an embedding with verbose option (ollama)", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "ollama",
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create an embedding with verbose option and cache (ollama)", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "ollama",
      verbose: true,
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should retrieve an embedding from cache (ollama)", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "ollama",
      verbose: true,
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
} else {
  console.log(
    "No Ollama provider selection or AI_EMBEDDINGS_MODEL in process.env",
  );
}

const canUseEnvironmentProvider = hasEmbeddingModel &&
  (environmentProvider === "ollama" ? hasOllama : hasGoogleCredentials);
if (canUseEnvironmentProvider) {
  Deno.test("should select the embedding provider from environment variables", async () => {
    const result = await getEmbedding("What is the capital of France?");
    assertEquals(Array.isArray(result), true);
    assertEquals(typeof result[0], "number");
  });
}
