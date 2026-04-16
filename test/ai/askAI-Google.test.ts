import "@std/dotenv/load";
import { assertEquals } from "jsr:@std/assert";
import askAI from "../../src/ai/askAI.ts";
import { existsSync, rmSync } from "node:fs";
import * as z from "zod";

const aiKey = Deno.env.get("AI_KEY") ?? Deno.env.get("AI_PROJECT");
if (typeof aiKey === "string" && aiKey !== "") {
  if (existsSync("./.journalism-cache")) {
    rmSync("./.journalism-cache", { recursive: true });
  }

  Deno.test("should run the doc example", async () => {
    const europeanCountries = await askAI(
      `Give me a list of three countries in Northern Europe.`,
      {
        returnJson: true,
        clean: (response: unknown) => {
          // When parseJson is true, response is the parsed JSON object/array
          // When parseJson is false, response is a string
          // Example: Trim whitespace from each country name in the array
          if (Array.isArray(response)) {
            return response.map((item) =>
              typeof item === "string" ? item.trim() : item
            );
          }
          return response;
        },
        test: (response) => {
          if (!Array.isArray(response)) {
            throw new Error("Response is not an array.");
          }
          if (response.length !== 3) {
            throw new Error("Response does not contain exactly three items.");
          }
          console.log(
            "Test passed: The response is a valid list of three countries.",
          );
        },
      },
    );
    console.log(europeanCountries);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt", async () => {
    const result = await askAI("What is the capital of France?", {
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a detailed response", async () => {
    const result = await askAI("What is the capital of France?", {
      verbose: true,
      detailedResponse: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should process multiple prompts with metrics option whith verbose false", async () => {
    const metrics = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
    };
    const result = await askAI("What is the capital of France?", {
      verbose: false,
      metrics,
    });
    console.log(result);
    console.log(metrics);
    const result2 = await askAI("What is the capital of Canada?", {
      verbose: false,
      metrics,
    });
    console.log(result2);
    console.log(metrics);
    const result3 = await askAI("What is the capital of Spain?", {
      verbose: false,
      metrics,
    });
    console.log(result3);
    console.log(metrics);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should process multiple prompts with metrics option whith verbose true", async () => {
    const metrics = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
    };
    const result = await askAI("What is the capital of France?", {
      verbose: true,
      metrics,
    });
    console.log(result);
    console.log(metrics);
    const result2 = await askAI("What is the capital of Canada?", {
      verbose: true,
      metrics,
    });
    console.log(result2);
    console.log(metrics);
    const result3 = await askAI("What is the capital of Spain?", {
      verbose: true,
      metrics,
    });
    console.log(result3);
    console.log(metrics);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with undefined thinking", async () => {
    const result = await askAI("What is the capital of France?", {
      verbose: true,
      model: "gemini-2.5-flash",
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt without thinking", async () => {
    const result = await askAI("What is the capital of France?", {
      thinkingBudget: 0,
      verbose: true,
      model: "gemini-2.5-flash",
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with thinking (5000)", async () => {
    const result = await askAI(
      "Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b. Return just the result. No explanations. But think carefully first.",
      {
        thinkingBudget: 5000,
        verbose: true,
        model: "gemini-2.5-flash",
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with dynamic thinking (-1) and detailed response and cache", async () => {
    const result = await askAI(
      "Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b. Return just the result. No explanations. But think carefully first.",
      {
        thinkingBudget: -1,
        model: "gemini-2.5-flash",
        cache: true,
        detailedResponse: true,
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached response", async () => {
    const result = await askAI(
      "Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b. Return just the result. No explanations. But think carefully first.",
      {
        thinkingBudget: -1,
        model: "gemini-2.5-flash",
        cache: true,
        detailedResponse: true,
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt without thinking and returning JSON", async () => {
    const result = await askAI("What is the capital of France?", {
      thinkingBudget: 0,
      verbose: true,
      returnJson: true,
      model: "gemini-2.5-flash",
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with thinking and returning JSON", async () => {
    const result = await askAI("What is the capital of France?", {
      thinkingBudget: 500,
      verbose: true,
      returnJson: true,
      model: "gemini-2.5-flash",
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a test", async () => {
    const result = await askAI("Give me a list of 3 countries in Europe.", {
      returnJson: true,
      test: (response: unknown) => {
        if (!Array.isArray(response)) {
          throw new Error(
            `Response is not an array: ${JSON.stringify(response)}`,
          );
        }
        if (response.length !== 3) {
          throw new Error(
            `Response does not contain three items: ${
              JSON.stringify(response)
            }`,
          );
        }
      },
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a list of tests", async () => {
    const result = await askAI("Give me a list of 3 countries in Europe.", {
      returnJson: true,
      test: [(response: unknown) => {
        if (!Array.isArray(response)) {
          throw new Error(
            `Response is not an array: ${JSON.stringify(response)}`,
          );
        }
        if (response.length !== 3) {
          throw new Error(
            `Response does not contain three items: ${
              JSON.stringify(response)
            }`,
          );
        }
      }],
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache", async () => {
    const result = await askAI("What is the capital of France?", {
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached data", async () => {
    const result = await askAI("What is the capital of France?", {
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache and json", async () => {
    const result = await askAI("What is the capital of France?", {
      cache: true,
      returnJson: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached JSON data", async () => {
    const result = await askAI("What is the capital of France?", {
      cache: true,
      returnJson: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache and verbose", async () => {
    await askAI("What is the capital of Canada?", {
      cache: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached data with verbose", async () => {
    await askAI("What is the capital of Canada?", {
      cache: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache and verbose and json", async () => {
    await askAI("What is the capital of Canada?", {
      cache: true,
      returnJson: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached json data with verbose and json", async () => {
    await askAI("What is the capital of Canada?", {
      cache: true,
      returnJson: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should use a simple prompt and return a json", async () => {
    const result = await askAI("What is the capital of France?", {
      returnJson: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should use a simple prompt and log extra information", async () => {
    await askAI("What is the capital of France?", {
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should scrape a web page", async () => {
    await askAI(
      `Here's the page showing presidential executive orders. Extract the executive order/names, dates (yyyy-mm-dd), and urls as an array of objects. Also categorize each executive order based on its name.`,
      {
        HTMLFrom:
          "https://www.whitehouse.gov/presidential-actions/executive-orders/",
        returnJson: true,
        verbose: true,
      },
    );

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should take a screenshot and analyze it", async () => {
    await askAI(
      `Tell me which products are on special.`,
      {
        screenshotFrom: "https://www.metro.ca/circulaire",
        verbose: true,
      },
    );

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should analyze an audio file", async () => {
    const audioResponse = await askAI(
      `Return an object with the name of the person talking and an approximate date of the speech if you recognize it.`,
      {
        audio: "test/data/ai/speech.mp3",
        returnJson: true,
        verbose: true,
      },
    );
    console.log(audioResponse);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should analyze images", async () => {
    const images = [];
    for await (const dirEntry of Deno.readDir("test/data/ai/pictures")) {
      images.push(`test/data/ai/pictures/${dirEntry.name}`);
    }

    await askAI(
      `Based on the images I send you, I want an array of objects with the following properties:
    - name: the person on the image if it's a human and you can recognize it,
    - description: a very short description of the image,
    - isPolitician: true is if it's a politician and false if it isn't.`,
      {
        image: images,
        verbose: true,
        returnJson: true,
      },
    );

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should analyze a video file", async () => {
    await askAI(
      `I want a array of objects, with each object having the following keys: name, timestamp, main emotion, transcript. Each time a new person talks, create a new object.`,
      {
        video: "test/data/ai/The Ontario leaders' debate in 3 minutes 360.mp4",
        returnJson: true,
        verbose: true,
      },
    );
    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test("should analyze a pdf file with a specific model", async () => {
    await askAI(
      `This is a supreme court decision. Give me the merits of the case in the document. I want to know what happened and when. Return a list of objects with a date and a brief summary for each important event. Sort them chronologically.`,
      {
        model: "gemini-2.0-flash",
        pdf: "test/data/ai/Piekut-en.pdf",
        returnJson: true,
        verbose: true,
      },
    );
    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should analyze different files with different formats", async () => {
    await askAI(
      `Give me a short description of each things I give you.`,
      {
        model: "gemini-2.0-flash",
        HTMLFrom:
          "https://www.whitehouse.gov/presidential-actions/executive-orders/",
        audio: "test/data/ai/speech.mp3",
        image: "test/data/ai/pictures/Screenshot 2025-03-21 at 1.36.14 PM.png",
        video: "test/data/ai/The Ontario leaders' debate in 3 minutes 360.mp4",
        pdf: "test/data/ai/Piekut-en.pdf",
        returnJson: true,
        verbose: true,
      },
    );
    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should return raw string when parseJson is false and returnJson is true", async () => {
    const result = await askAI("Give me a list of 3 countries in Europe.", {
      returnJson: true,
      parseJson: false,
    });
    console.log(result);
    // Should be a string, not an array
    if (Array.isArray(result)) {
      throw new Error(
        "Result should not be parsed as JSON when parseJson is false",
      );
    }
    assertEquals(typeof result, "string");
  });

  Deno.test("should use a text file", async () => {
    await askAI(
      "What is the content of this text file?",
      {
        text: "test/data/data.csv",
        verbose: true,
      },
    );
    assertEquals(true, true);
  });
  Deno.test("should use an image file stored in a google bucket", async () => {
    await askAI("What is in this image?", {
      verbose: true,
      image: "gs://nael_test_bucket/journalism-tests/cat.png",
    });
    assertEquals(true, true);
  });
  Deno.test("should use a video file stored in a google bucket", async () => {
    await askAI("What is happening in this video?", {
      verbose: true,
      video: "gs://nael_test_bucket/journalism-tests/debate.mp4",
    });
    assertEquals(true, true);
  });
  Deno.test("should use a pdf file stored in a google bucket", async () => {
    await askAI("What is this document about?", {
      verbose: true,
      pdf: "gs://nael_test_bucket/journalism-tests/piekut.pdf",
    });
    assertEquals(true, true);
  });
  Deno.test("should use an audio file stored in a google bucket", async () => {
    await askAI("What is this audio about?", {
      verbose: true,
      audio: "gs://nael_test_bucket/journalism-tests/speech.mp3",
    });
    assertEquals(true, true);
  });
  Deno.test("should use a text file stored in a google bucket", async () => {
    await askAI("What is the content of this text file?", {
      verbose: true,
      text: "gs://nael_test_bucket/journalism-tests/data.csv",
    });
    assertEquals(true, true);
  });
  Deno.test("should answer without grounding with web search", async () => {
    await askAI("Who is Nael Shiab?", {
      verbose: true,
    });
    assertEquals(true, true);
  });
  Deno.test("should answer with grounding with web search and caching", async () => {
    await askAI("Who is Nael Shiab?", {
      verbose: true,
      webSearch: true,
      cache: true,
    });
    assertEquals(true, true);
  });
  Deno.test("should answer with grounding with web search and return cached data", async () => {
    await askAI("Who is Nael Shiab?", {
      verbose: true,
      webSearch: true,
      cache: true,
    });
    assertEquals(true, true);
  });

  Deno.test("should return a structured output and cache it", async () => {
    const schema = z.toJSONSchema(
      z.array(z.object({
        name: z.string(),
        age: z.number(),
        gender: z.enum(["man", "woman"]),
      })),
    );

    await askAI("Give me 10 random people.", {
      verbose: true,
      cache: true,
      schemaJson: schema,
    });
    assertEquals(true, true);
  });
  Deno.test("should return a cached structured output", async () => {
    const schema = z.toJSONSchema(
      z.array(z.object({
        name: z.string(),
        age: z.number(),
        gender: z.enum(["man", "woman"]),
      })),
    );

    await askAI("Give me 10 random people.", {
      verbose: true,
      cache: true,
      schemaJson: schema,
    });
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level minimal by default", async () => {
    await askAI("Give me 10 random people.", {
      verbose: true,
      cache: true,
      includeThoughts: true,
      model: "gemini-3-flash-preview",
    });
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level medium", async () => {
    await askAI("Give me 10 random people.", {
      verbose: true,
      cache: true,
      thinkingLevel: "medium",
      includeThoughts: true,
      model: "gemini-3-flash-preview",
    });
    assertEquals(true, true);
  });
  Deno.test("should work without a system prompt", async () => {
    await askAI("Why is the sky blue?", {
      verbose: true,
    });
    assertEquals(true, true);
  });
  Deno.test("should work with a system prompt", async () => {
    await askAI("Why is the sky blue?", {
      verbose: true,
      systemPrompt: "Always answer with rhymes.",
    });
    assertEquals(true, true);
  });
  Deno.test("should accept safetyEnabled option", async () => {
    await askAI("What is the capital of France?", {
      safetyEnabled: false,
    });
    assertEquals(true, true);
  });
} else {
  console.log("No AI_PROJECT in process.env");
}
