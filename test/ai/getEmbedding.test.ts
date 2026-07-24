import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import getEmbedding from "../../src/ai/getEmbedding.ts";
import { Ollama } from "ollama";

const aiKey = Deno.env.get("AI_KEY");
const aiProject = Deno.env.get("AI_PROJECT");
const aiLocation = Deno.env.get("AI_LOCATION");
const embeddingModel = Deno.env.get("AI_EMBEDDINGS_MODEL");
const embeddingsProvider = Deno.env.get("AI_EMBEDDINGS_PROVIDER");
const legacyOllama = Deno.env.get("OLLAMA");
const hasGeminiCredentials = Boolean(aiKey) ||
  (Boolean(aiProject) && Boolean(aiLocation));
const hasEmbeddingModel = Boolean(embeddingModel);
const hasOllama = embeddingsProvider === "ollama" || Boolean(legacyOllama);
const environmentProvider = embeddingsProvider ??
  (legacyOllama ? "ollama" : "gemini");

if (hasEmbeddingModel && hasGeminiCredentials) {
  Deno.test("should create an embedding", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "gemini",
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create an embedding with verbose option", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "gemini",
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should create an embedding with verbose option and cache", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "gemini",
      verbose: true,
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should retrieve an embedding from cache", async () => {
    const result = await getEmbedding("What is the capital of France?", {
      provider: "gemini",
      verbose: true,
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
} else {
  console.log(
    "No Gemini credentials or AI_EMBEDDINGS_MODEL in process.env",
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
  (environmentProvider === "ollama" ? hasOllama : hasGeminiCredentials);
if (canUseEnvironmentProvider) {
  Deno.test("should select the embedding provider from environment variables", async () => {
    const result = await getEmbedding("What is the capital of France?");
    assertEquals(Array.isArray(result), true);
    assertEquals(typeof result[0], "number");
  });
}
