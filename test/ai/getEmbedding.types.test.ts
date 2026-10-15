import { test, expectTypeOf } from "vite-plus/test";
import { getEmbedding } from "../../src/index.ts";
type GetEmbeddingOptions = NonNullable<Parameters<typeof getEmbedding>[1]>;
import { Ollama } from "ollama";

test("embedding options are provider-aware at compile time", () => {
  const validOptions: GetEmbeddingOptions[] = [
    { model: "environment-model", cache: true, verbose: false },
    { provider: "gemini", model: "gemini-model", apiKey: "key" },
    {
      provider: "gemini",
      vertex: true,
      model: "vertex-model",
      project: "project",
      location: "location",
    },
    {
      provider: "ollama",
      model: "ollama-model",
      contextWindow: 8_192,
      ollama: new Ollama(),
    },
  ];

  expectTypeOf(validOptions).toExtend<GetEmbeddingOptions[]>();
  expectTypeOf<{ model: string; apiKey: string }>().not.toExtend<GetEmbeddingOptions>();
  expectTypeOf<{
    provider: "gemini";
    model: string;
    contextWindow: number;
  }>().not.toExtend<GetEmbeddingOptions>();
  expectTypeOf<{
    provider: "ollama";
    model: string;
    apiKey: string;
  }>().not.toExtend<GetEmbeddingOptions>();
  expectTypeOf<{
    provider: "gemini";
    model: string;
    project: string;
    location: string;
  }>().not.toExtend<GetEmbeddingOptions>();
  expectTypeOf<{ model: string; ollama: true }>().not.toExtend<GetEmbeddingOptions>();

  if (validOptions.length !== 4) throw new Error("Invalid type fixture");
});
