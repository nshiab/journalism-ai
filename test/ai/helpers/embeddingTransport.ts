import { z } from "zod";

/** Mocks the public HTTP protocols used by the embedding providers. */
export function embeddingTransport(
  provider: "openai" | "gemini" | "google-agent-platform" | "ollama",
  vector: unknown[] = [1, 2],
) {
  const requests: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({
      url: request.url,
      body: z.record(z.string(), z.unknown()).parse(await request.json()),
      headers: request.headers,
    });
    if (provider === "openai")
      return Response.json({
        object: "list",
        model: "embedding-test",
        data: [{ object: "embedding", index: 0, embedding: vector }],
        usage: { prompt_tokens: 2, total_tokens: 2 },
      });
    if (provider === "ollama")
      return Response.json({ model: "embedding-test", embeddings: [vector], prompt_eval_count: 2 });
    if (request.url.includes(":embedContent"))
      return Response.json({ embedding: { values: vector } });
    if (provider === "google-agent-platform")
      return Response.json({
        predictions: [{ embeddings: { values: vector, statistics: { token_count: 2 } } }],
      });
    return Response.json({ embeddings: [{ values: vector }] });
  };
  return { requests, fetch };
}
