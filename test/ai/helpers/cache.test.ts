import { assertEquals, assertRejects } from "jsr:@std/assert";
import { existsSync, writeFileSync } from "node:fs";
import { readAndProcessCache } from "../../../src/ai/helpers/cache.ts";

Deno.test("processes cached responses synchronously and asynchronously", async () => {
  const cacheFile = await Deno.makeTempFile();
  writeFileSync(cacheFile, JSON.stringify({ response: "raw", count: 1 }));

  const syncResult = await readAndProcessCache<
    { response: unknown; count: number },
    string
  >(
    cacheFile,
    (response) => String(response).toUpperCase(),
  );
  const asyncResult = await readAndProcessCache<
    { response: unknown; count: number },
    string
  >(
    cacheFile,
    async (response) => `${response}-async`,
  );

  assertEquals(syncResult, { response: "RAW", count: 1 });
  assertEquals(asyncResult, { response: "raw-async", count: 1 });
});

Deno.test("removes a cached response when processing rejects it", async () => {
  const cacheFile = await Deno.makeTempFile();
  writeFileSync(cacheFile, JSON.stringify({ response: "invalid" }));

  await assertRejects(
    () =>
      readAndProcessCache(cacheFile, () => {
        throw new Error("Invalid response");
      }),
    Error,
    "Invalid response",
  );

  assertEquals(existsSync(cacheFile), false);
});
