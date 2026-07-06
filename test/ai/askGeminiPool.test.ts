import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import askGeminiPool from "../../src/ai/askGeminiPool.ts";
import * as z from "zod";

const aiKey = Deno.env.get("AI_KEY") ?? Deno.env.get("AI_PROJECT");
if (typeof aiKey === "string" && aiKey !== "") {
  Deno.test("should run the doc example", async () => {
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
    const { results, errors } = await askGeminiPool(
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
  Deno.test("should not ground results with web search", async () => {
    const { results, errors } = await askGeminiPool(
      [
        { prompt: "Who is Nael Shiab (CBC News)?" },
        { prompt: "Who is Elizabeth Haggarty (CBC News)?" },
        { prompt: "Who is Graeme Bruce (CBC News)?" },
      ],
      5,
    );
    console.log(results);
    console.log(errors);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  Deno.test("should ground results with web search", async () => {
    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "Who is Nael Shiab (CBC News)?",
          options: { webSearch: true },
        },
        {
          prompt: "Who is Elizabeth Haggarty (CBC News)?",
          options: { webSearch: true },
        },
        {
          prompt: "Who is Graeme Bruce (CBC News)?",
          options: { webSearch: true },
        },
      ],
      5,
    );
    console.log(results);
    console.log(errors);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  Deno.test("should return structured output", async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );

    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "Give me 5 characters from Harry Potter.",
          options: { schemaJson: schema },
        },
        {
          prompt: "Give me 5 characters from Lord of the Rings.",
          options: { schemaJson: schema },
        },
        {
          prompt: "Give me 5 characters from Avengers.",
          options: { schemaJson: schema },
        },
      ],
      5,
    );
    console.log(results);
    console.log(errors);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  Deno.test("should run with minimal thinking level by default", async () => {
    const metrics = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
    };

    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "How do you feel?",
          options: {
            model: "gemini-3-flash-preview",
            verbose: true,
            includeThoughts: true,
          },
        },
        {
          prompt: "Where do you live?",
          options: {
            model: "gemini-3-flash-preview",
            verbose: true,
            includeThoughts: true,
          },
        },
        {
          prompt: "Do you have a consciousness?",
          options: {
            model: "gemini-3-flash-preview",
            verbose: true,
            includeThoughts: true,
          },
        },
      ],
      1,
      { metrics, logProgress: true },
    );
    console.log(results);
    console.log(errors);
    console.table(metrics);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
  Deno.test("should run with high thinking level by default", async () => {
    const metrics = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
    };

    const { results, errors } = await askGeminiPool(
      [
        {
          prompt: "How do you feel?",
          options: {
            thinkingLevel: "high",
            model: "gemini-3-flash-preview",
            verbose: true,
            includeThoughts: true,
          },
        },
        {
          prompt: "Where do you live?",
          options: {
            thinkingLevel: "high",
            model: "gemini-3-flash-preview",
            verbose: true,
            includeThoughts: true,
          },
        },
        {
          prompt: "Do you have a consciousness?",
          options: {
            thinkingLevel: "high",
            model: "gemini-3-flash-preview",
            verbose: true,
            includeThoughts: true,
          },
        },
      ],
      1,
      { metrics, logProgress: true },
    );
    console.log(results);
    console.log(errors);
    console.table(metrics);

    assertEquals(errors.length, 0);
    assertEquals(results.length, 3);
  });
} else {
  console.log("No AI_KEY or AI_PROJECT in process.env");
}
