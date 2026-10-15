import { z } from "zod";
import { test } from "vite-plus/test";
import { deepStrictEqual as assertEquals, rejects as assertRejects } from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { readAndProcessCache } from "../../../src/ai/helpers/cache.ts";

test("processes cached responses synchronously and asynchronously", async () => {
  const cacheFile = `cache-${crypto.randomUUID()}.json`;
  writeFileSync(cacheFile, JSON.stringify({ response: "raw", count: 1 }));

  const syncResult = await readAndProcessCache(
    cacheFile,
    (value) => z.object({ response: z.unknown(), count: z.number() }).parse(value),
    (response) => String(response).toUpperCase(),
  );
  const asyncResult = await readAndProcessCache(
    cacheFile,
    (value) => z.object({ response: z.unknown(), count: z.number() }).parse(value),
    async (response) => `${String(response)}-async`,
  );

  assertEquals(syncResult, { response: "RAW", count: 1 });
  assertEquals(asyncResult, { response: "raw-async", count: 1 });
});

test("removes a cached response when processing rejects it", async () => {
  const cacheFile = `cache-${crypto.randomUUID()}.json`;
  writeFileSync(cacheFile, JSON.stringify({ response: "invalid" }));

  await assertRejects(
    () =>
      readAndProcessCache(
        cacheFile,
        (value) => z.object({ response: z.unknown() }).parse(value),
        () => {
          throw new Error("Invalid response");
        },
      ),
    /Invalid response/,
  );

  assertEquals(existsSync(cacheFile), false);
});
