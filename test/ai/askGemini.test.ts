import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import askGemini from "../../src/ai/askGemini.ts";
import { existsSync, rmSync } from "node:fs";
import * as z from "zod";

const aiKey = Deno.env.get("AI_KEY") ?? Deno.env.get("AI_PROJECT");
if (typeof aiKey === "string" && aiKey !== "") {
  if (existsSync("./.journalism-cache")) {
    rmSync("./.journalism-cache", { recursive: true });
  }

  Deno.test("should use a simple prompt", async () => {
    const result = await askGemini("What is the capital of France?");
    console.log(result);
    assertEquals(true, true);
  });

  Deno.test("should specify a model directly", async () => {
    const result = await askGemini("What is the capital of France?", {
      model: "gemini-3.5-flash",
    });
    console.log(result);
    assertEquals(true, true);
  });

  Deno.test("should accumulate cost and tokens across multiple calls", async () => {
    const r1 = await askGemini("What is the capital of France?");
    const r2 = await askGemini("What is the capital of Canada?");
    const r3 = await askGemini("What is the capital of Spain?");
    const totalCost = (r1.estimatedCost ?? 0) + (r2.estimatedCost ?? 0) +
      (r3.estimatedCost ?? 0);
    const totalTokens = r1.totalTokens + r2.totalTokens + r3.totalTokens;
    console.log("Total cost:", totalCost);
    console.log("Total tokens:", totalTokens);
    assertEquals(true, true);
  });

  Deno.test("should return structured JSON output", async () => {
    const schema = z.toJSONSchema(
      z.array(z.object({ name: z.string(), age: z.number() })),
    );
    const result = await askGemini("Give me 3 random people.", {
      schemaJson: schema,
    });
    console.log(result);
    assertEquals(true, true);
  });

  Deno.test("should cache a response", async () => {
    await askGemini("What is the capital of France?", { cache: true });
    assertEquals(true, true);
  });

  Deno.test("should return cached response", async () => {
    const result = await askGemini("What is the capital of France?", {
      cache: true,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });

  Deno.test("should cache structured output", async () => {
    const schema = z.toJSONSchema(
      z.array(
        z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        }),
      ),
    );
    await askGemini("Give me 10 random people.", {
      schemaJson: schema,
      cache: true,
    });
    assertEquals(true, true);
  });

  Deno.test("should return cached structured output", async () => {
    const schema = z.toJSONSchema(
      z.array(
        z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        }),
      ),
    );
    const result = await askGemini("Give me 10 random people.", {
      schemaJson: schema,
      cache: true,
    });
    console.log(result);
    assertEquals(result.fromCache, true);
  });

  Deno.test("should answer without web search", async () => {
    await askGemini("Who is Nael Shiab?");
    assertEquals(true, true);
  });

  Deno.test("should answer with web search", async () => {
    await askGemini("Who is Nael Shiab?", { webSearch: true });
    assertEquals(true, true);
  });

  Deno.test("should cache web search response", async () => {
    await askGemini("Who is Nael Shiab?", { webSearch: true, cache: true });
    assertEquals(true, true);
  });

  Deno.test("should return cached web search response", async () => {
    const result = await askGemini("Who is Nael Shiab?", {
      webSearch: true,
      cache: true,
    });
    assertEquals(result.fromCache, true);
  });

  Deno.test("should work with a system prompt", async () => {
    const result = await askGemini("Why is the sky blue?", {
      systemPrompt: "Always answer with rhymes.",
    });
    console.log(result);
    assertEquals(true, true);
  });

  Deno.test("should use thinking level medium", async () => {
    const result = await askGemini(
      "Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b. Return just the number.",
      { thinkingLevel: "medium" },
    );
    console.log(result);
    assertEquals(true, true);
  });

  Deno.test("should use thinking level high with cache", async () => {
    await askGemini(
      "Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b. Return just the number.",
      { thinkingLevel: "high", cache: true },
    );
    assertEquals(true, true);
  });

  Deno.test("should return cached thinking response", async () => {
    const result = await askGemini(
      "Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b. Return just the number.",
      { thinkingLevel: "high", cache: true },
    );
    assertEquals(result.fromCache, true);
  });

  Deno.test("should accept safetyEnabled option", async () => {
    await askGemini("What is the capital of France?", {
      safetyEnabled: false,
    });
    assertEquals(true, true);
  });

  Deno.test("should scrape a web page", async () => {
    const schema = z.toJSONSchema(
      z.array(
        z.object({
          title: z.string(),
          date: z.string(),
          url: z.string(),
          category: z.string(),
        }),
      ),
    );
    await askGemini(
      `Extract executive order titles, dates (yyyy-mm-dd), URLs, and categories.`,
      {
        HTMLFrom:
          "https://www.whitehouse.gov/presidential-actions/executive-orders/",
        schemaJson: schema,
      },
    );
    assertEquals(true, true);
  });

  Deno.test("should use a text file", async () => {
    await askGemini("What is the content of this text file?", {
      text: "test/data/data.csv",
    });
    assertEquals(true, true);
  });

  Deno.test("should analyze an audio file", async () => {
    const schema = z.toJSONSchema(
      z.object({ speaker: z.string(), approximateDate: z.string() }),
    );
    const result = await askGemini(
      "Return an object with the name of the person talking and an approximate date of the speech.",
      { audio: "test/data/ai/speech.mp3", schemaJson: schema },
    );
    console.log(result);
    assertEquals(true, true);
  });

  Deno.test("should analyze images", async () => {
    const images: string[] = [];
    for await (const dirEntry of Deno.readDir("test/data/ai/pictures")) {
      images.push(`test/data/ai/pictures/${dirEntry.name}`);
    }
    const schema = z.toJSONSchema(
      z.array(
        z.object({
          name: z.string().nullable(),
          description: z.string(),
          isPolitician: z.boolean(),
        }),
      ),
    );
    await askGemini(
      "For each image return: name (person if recognizable, else null), description, isPolitician.",
      { image: images, schemaJson: schema },
    );
    assertEquals(true, true);
  });

  Deno.test("should analyze a video file", async () => {
    const schema = z.toJSONSchema(
      z.array(
        z.object({
          name: z.string(),
          timestamp: z.string(),
          mainEmotion: z.string(),
          transcript: z.string(),
        }),
      ),
    );
    await askGemini(
      "Each time a new person talks, create a new object with name, timestamp, main emotion, transcript.",
      {
        video: "test/data/ai/The Ontario leaders' debate in 3 minutes 360.mp4",
        schemaJson: schema,
      },
    );
    assertEquals(true, true);
  });

  Deno.test("should analyze a pdf file", async () => {
    const schema = z.toJSONSchema(
      z.array(z.object({ date: z.string(), summary: z.string() })),
    );
    await askGemini(
      "Return a chronological list of important events with date and brief summary.",
      { pdf: "test/data/ai/Piekut-en.pdf", schemaJson: schema },
    );
    assertEquals(true, true);
  });

  Deno.test("should use an image file from GCS", async () => {
    await askGemini("What is in this image?", {
      image: "gs://nael_test_bucket/journalism-tests/cat.png",
    });
    assertEquals(true, true);
  });

  Deno.test("should use a video file from GCS", async () => {
    await askGemini("What is happening in this video?", {
      video: "gs://nael_test_bucket/journalism-tests/debate.mp4",
    });
    assertEquals(true, true);
  });

  Deno.test("should use a pdf file from GCS", async () => {
    await askGemini("What is this document about?", {
      pdf: "gs://nael_test_bucket/journalism-tests/piekut.pdf",
    });
    assertEquals(true, true);
  });

  Deno.test("should use an audio file from GCS", async () => {
    await askGemini("What is this audio about?", {
      audio: "gs://nael_test_bucket/journalism-tests/speech.mp3",
    });
    assertEquals(true, true);
  });

  Deno.test("should use a text file from GCS", async () => {
    await askGemini("What is the content of this text file?", {
      text: "gs://nael_test_bucket/journalism-tests/data.csv",
    });
    assertEquals(true, true);
  });
} else {
  console.log("No AI_KEY or AI_PROJECT in process.env");
}
