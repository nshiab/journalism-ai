import { getEmbedding, type GetEmbeddingOptions } from "../../src/index.ts";
import { Ollama } from "ollama";

Deno.test("embedding options are provider-aware at compile time", () => {
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

  if (false) {
    for (const options of validOptions) void getEmbedding("text", options);

    // @ts-expect-error Providerless options contain common fields only.
    void getEmbedding("text", { model: "model", apiKey: "key" });
    void getEmbedding("text", {
      provider: "gemini",
      model: "model",
      // @ts-expect-error Ollama fields are not valid for Gemini.
      contextWindow: 2_048,
    });
    void getEmbedding("text", {
      provider: "ollama",
      model: "model",
      // @ts-expect-error Gemini fields are not valid for Ollama.
      apiKey: "key",
    });
    // @ts-expect-error Vertex deployment fields require explicit Vertex selection.
    void getEmbedding("text", {
      provider: "gemini",
      model: "model",
      project: "project",
      location: "location",
    });
    // @ts-expect-error Boolean Ollama selection is deprecated in the public type.
    void getEmbedding("text", { model: "model", ollama: true });
  }

  if (validOptions.length !== 4) throw new Error("Invalid type fixture");
});
