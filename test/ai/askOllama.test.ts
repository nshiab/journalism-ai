import "@std/dotenv/load";
import { assertEquals, assertRejects } from "jsr:@std/assert";
import askOllama from "../../src/ai/askOllama.ts";
import { existsSync, rmSync } from "node:fs";
import { Ollama } from "ollama";
import * as z from "zod";

const ollamaEnv = Deno.env.get("OLLAMA");
console.log("OLLAMA", ollamaEnv);
if (ollamaEnv) {
  if (existsSync("./.journalism-cache")) {
    rmSync("./.journalism-cache", { recursive: true });
  }
  Deno.test("should use a simple prompt (ollama)", async () => {
    const result = await askOllama("What is the capital of France?", {
      verbose: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a high temperature (ollama)", async () => {
    const result = await askOllama("What is the capital of France?", {
      verbose: true,
      temperature: 1,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with thinking (ollama)", {
    sanitizeResources: false,
  }, async () => {
    const result = await askOllama("What is the capital of France?", {
      verbose: true,
      thinkingBudget: 1,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test(
    "should use a simple prompt with thinking and returning JSON (ollama)",
    {
      sanitizeResources: false,
    },
    async () => {
      const result = await askOllama(
        "What is the capital of France? Return a JSON with this shape: {country: string, capital: string}",
        {
          verbose: true,
          thinkingBudget: 1,
          returnJson: true,
          clean: (response) =>
            typeof response === "string"
              ? response.replace(`{"{"`, `{"`)
              : response,
        },
      );
      console.log(result);

      // Just making sure it doesn't crash for now.
      assertEquals(true, true);
    },
  );
  Deno.test(
    "should use a simple prompt with a different Ollama instance (ollama)",
    { sanitizeResources: false },
    async () => {
      const ollamaClient = new Ollama({ host: "http://127.0.0.1:11434" });

      const result = await askOllama("What is the capital of France?", {
        ollama: ollamaClient,
      });
      console.log(result);

      // Just making sure it doesn't crash for now.
      assertEquals(true, true);
    },
  );
  Deno.test("should use a simple prompt with a cleaning and test functions (ollama)", async () => {
    const result = await askOllama(
      "Give me a list of 3 countries in Europe.",
      {
        returnJson: true,
        cache: true,
        clean: (response: unknown) =>
          typeof response === "object" && response !== null &&
            "countries" in response
            ? response.countries
            : response,
        test: (response: unknown) => {
          if (
            Array.isArray(response) &&
            response.length !== 3
          ) {
            throw new Error(
              `Response does not contain three items: ${
                JSON.stringify(response)
              }`,
            );
          }
        },
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with a cleaning and test functions and return cached data (ollama)", async () => {
    const result = await askOllama(
      "Give me a list of 3 countries in Europe.",
      {
        returnJson: true,
        cache: true,
        clean: (response: unknown) =>
          typeof response === "object" && response !== null &&
            "countries" in response
            ? response.countries
            : response,
        test: (response: unknown) => {
          if (
            Array.isArray(response) &&
            response.length !== 3
          ) {
            throw new Error(
              `Response does not contain three items: ${
                JSON.stringify(response)
              }`,
            );
          }
        },
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use be able to clean complex response (ollama)", {
    sanitizeResources: false,
  }, async () => {
    const result = await askOllama(
      `Guess whether it's a "Man" or a "Woman". If it could be both, return "Neutral". Return an objects with two keys in it: one with the names as an array and the other with the genders as an array.
  Here are the name values as a JSON array:
  ["Marie","John","Alex"]
  Return your results in a JSON array as well. It's critical you return the same number of items, which is 3, exactly in the same order.`,
      {
        returnJson: true,
        cache: true,
        clean: (response: unknown) => {
          if (
            typeof response === "object" && response !== null &&
            "genders" in response
          ) {
            return (response as { genders: string[] }).genders;
          }
          return response;
        },
        test: (response: unknown) => {
          if (
            !Array.isArray(response) ||
            response.length !== 3
          ) {
            throw new Error(
              `Response does not contain three items: ${
                JSON.stringify(response)
              }`,
            );
          }
        },
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache (ollama)", async () => {
    const result = await askOllama("What is the capital of France?", {
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached data", async () => {
    const result = await askOllama("What is the capital of France?", {
      cache: true,
    });
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache and json", async () => {
    const result = await askOllama(
      "What is the capital of France? Return a JSON",
      {
        cache: true,
        returnJson: true,
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached JSON data (ollama)", async () => {
    const result = await askOllama(
      "What is the capital of France? Return a JSON",
      {
        cache: true,
        returnJson: true,
      },
    );
    console.log(result);

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache and verbose", async () => {
    await askOllama("What is the capital of Canada?", {
      cache: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached data with verbose (ollama)", async () => {
    await askOllama("What is the capital of Canada?", {
      cache: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt with cache and verbose and json (ollama)", async () => {
    await askOllama("What is the capital of Canada? Return a JSON.", {
      cache: true,
      returnJson: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and return cached json data with verbose and json (ollama)", async () => {
    await askOllama("What is the capital of Canada? Return a JSON.", {
      cache: true,
      returnJson: true,
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });
  Deno.test("should use a simple prompt and log extra information (ollama)", async () => {
    await askOllama("What is the capital of France?", {
      verbose: true,
    });

    // Just making sure it doesn't crash for now.
    assertEquals(true, true);
  });

  Deno.test(
    "should scrape a web page with default context window size (ollama)",
    { sanitizeResources: false },
    async () => {
      await askOllama(
        `What is this website about?`,
        {
          HTMLFrom: "https://www.code-like-a-journalist.com/en",
          returnJson: true,
          verbose: true,
          cache: true,
        },
      );

      // Just making sure it doesn't crash for now.
      assertEquals(true, true);
    },
  );

  Deno.test(
    "should scrape a web page with specific context window size (ollama)",
    { sanitizeResources: false },
    async () => {
      await askOllama(
        `What is this website about?`,
        {
          HTMLFrom: "https://www.code-like-a-journalist.com/en",
          returnJson: true,
          verbose: true,
          contextWindow: 32000,
          cache: true,
        },
      );

      // Just making sure it doesn't crash for now.
      assertEquals(true, true);
    },
  );
  Deno.test(
    "should analyze images (ollama)",
    { sanitizeResources: false },
    async () => {
      await askOllama(
        `I want an object with the following properties:
        - name: the person on the image,
        - description: a very short description of the image,
        - isPolitician: true is if it's a politician and false if it isn't.
    Return a JSON.`,
        {
          image:
            "test/data/ai/pictures/Screenshot 2025-03-21 at 1.36.47 PM.png",
          verbose: true,
          returnJson: true,
        },
      );

      // Just making sure it doesn't crash for now.
      assertEquals(true, true);
    },
  );
  Deno.test("should use a text file (ollama)", async () => {
    const result = await askOllama(
      "What is the content of this text file?",
      {
        text: "test/data/data.csv",
        verbose: true,
      },
    );
    console.log(result);
    assertEquals(true, true);
  });
  Deno.test("should return raw string when parseJson is false and returnJson is true", async () => {
    const result = await askOllama("Give me a list of 3 countries in Europe.", {
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
  Deno.test("should return a structured output and cache it", {
    sanitizeResources: false,
  }, async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );

    await askOllama("Give me 10 random people.", {
      verbose: true,
      cache: true,
      schemaJson: schema,
    });
    assertEquals(true, true);
  });
  Deno.test("should return a cached structured output", {
    sanitizeResources: false,
  }, async () => {
    const schema = z.toJSONSchema(
      z.object({
        people: z.array(z.object({
          name: z.string(),
          age: z.number(),
          gender: z.enum(["man", "woman"]),
        })),
      }),
    );

    await askOllama("Give me 10 random people.", {
      verbose: true,
      cache: true,
      schemaJson: schema,
    });
    assertEquals(true, true);
  });
  Deno.test("should work without a system prompt", async () => {
    await askOllama("Why is the sky blue?", {
      verbose: true,
    });
    assertEquals(true, true);
  });
  Deno.test("should work with a system prompt", async () => {
    await askOllama("Why is the sky blue?", {
      verbose: true,
      systemPrompt: "Always answer with rhymes.",
    });
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level low by default", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      {
        verbose: true,
        includeThoughts: true,
        thinkingLevel: "low",
      },
    );
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level low", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      {
        verbose: true,
        includeThoughts: true,
        thinkingLevel: "low",
      },
    );
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level medium", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      {
        verbose: true,
        thinkingLevel: "medium",
        includeThoughts: true,
      },
    );
    assertEquals(true, true);
  });
  Deno.test("should work with thinking level high", {
    sanitizeResources: false,
  }, async () => {
    await askOllama(
      "Give me 10 random people (name, age, nationality, gender, profession). Make sure they are diverse.",
      {
        verbose: true,
        thinkingLevel: "high",
        includeThoughts: true,
      },
    );
    assertEquals(true, true);
  });
} else {
  console.log("No OLLAMA in process.env");
}

Deno.test("should throw an error for GCS files (ollama)", async () => {
  await assertRejects(
    () =>
      askOllama(
        `What is in this file?`,
        { text: "gs://some-bucket/file.csv", model: "llama3" },
      ),
    Error,
    "Ollama does not support Google Cloud Storage files.",
  );
});
