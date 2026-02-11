import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import askAIPool from "../../src/ai/askAIPool.ts";

const aiKey = Deno.env.get("AI_KEY") ?? Deno.env.get("AI_PROJECT");
if (typeof aiKey === "string" && aiKey !== "") {
  Deno.test("should run the doc example", async () => {
    const { results, errors } = await askAIPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
      ],
      5,
    );
    console.log(results);
    console.log(errors);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  Deno.test("should use request ids", async () => {
    const { results, errors } = await askAIPool(
      [
        { id: "france", prompt: "What is the capital of France?" },
        { id: "germany", prompt: "What is the capital of Germany?" },
      ],
      2,
    );
    console.log(results);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 2);
    assertEquals(results[0].request.id, "france");
    assertEquals(results[1].request.id, "germany");
  });
  Deno.test("should process requests with options", async () => {
    const { results, errors } = await askAIPool(
      [
        {
          prompt: "Give me a list of 3 countries in Europe.",
          options: { returnJson: true },
        },
        {
          prompt: "Give me a list of 3 countries in Asia.",
          options: { returnJson: true },
        },
      ],
      2,
    );
    console.log(results);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 2);
  });
  Deno.test("should log progress", async () => {
    const { results, errors } = await askAIPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
        { prompt: "What is the capital of Spain?" },
        { prompt: "What is the capital of Portugal?" },
        { prompt: "What is the capital of Greece?" },
        { prompt: "What is the capital of Netherlands?" },
        { prompt: "What is the capital of Belgium?" },
        { prompt: "What is the capital of Switzerland?" },
        { prompt: "What is the capital of Austria?" },
        { prompt: "What is the capital of Poland?" },
        { prompt: "What is the capital of Czech Republic?" },
      ],
      5,
      { logProgress: true },
    );
    console.log(results);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 12);
  });
  Deno.test("should track metrics", async () => {
    const metrics = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
    };
    const { results, errors } = await askAIPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
      ],
      2,
      { metrics, logProgress: true },
    );
    console.log(results);
    console.log(metrics);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(metrics.totalRequests, 3);
  });
  Deno.test("should enforce minimum request duration", async () => {
    const start = Date.now();
    const { results, errors } = await askAIPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
      ],
      1,
      { minRequestDurationMs: 2000 },
    );
    const duration = Date.now() - start;
    console.log(`Duration: ${duration}ms`);
    console.log(results);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 2);
  });
  Deno.test("should return results sorted by original index", async () => {
    const { results, errors } = await askAIPool(
      [
        { prompt: "What is the capital of France?" },
        { prompt: "What is the capital of Germany?" },
        { prompt: "What is the capital of Italy?" },
      ],
      3,
    );

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
    assertEquals(results[0].index, 0);
    assertEquals(results[1].index, 1);
    assertEquals(results[2].index, 2);
  });
  Deno.test("should use test and clean options on individual requests", async () => {
    const { results, errors } = await askAIPool(
      [
        {
          prompt: "Give me a list of 3 countries in Europe.",
          options: {
            returnJson: true,
            clean: (response: unknown) => {
              if (Array.isArray(response)) {
                return response.map((item) =>
                  typeof item === "string" ? item.trim() : item
                );
              }
              return response;
            },
            test: (response: unknown) => {
              if (!Array.isArray(response)) {
                throw new Error("Response is not an array.");
              }
              if (response.length !== 3) {
                throw new Error(
                  "Response does not contain exactly three items.",
                );
              }
            },
          },
        },
      ],
      1,
    );
    console.log(results);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 1);
  });
  Deno.test("should use a text file as input", async () => {
    const { results, errors } = await askAIPool(
      [
        {
          prompt: "What is the content of this text file?",
          options: { text: "test/data/data.csv" },
        },
      ],
      1,
    );
    console.log(results);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 1);
  });
} else {
  console.log("No AI_KEY or AI_PROJECT in process.env");
}
