import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_PATH = "./.journalism-cache";

/**
 * Initialises the cache directory and returns deterministic file paths
 * derived from a SHA-256 hash of the request parameters and optional
 * clean function.
 */
export function initCache(
  hashInput: unknown,
  cleanFn?: (r: unknown) => unknown,
): { cacheFileJSON: string; cacheFileText: string } {
  if (!existsSync(CACHE_PATH)) {
    mkdirSync(CACHE_PATH);
  }
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ ...(hashInput as object), clean: cleanFn }))
    .digest("hex");
  return {
    cacheFileJSON: `${CACHE_PATH}/askAI-${hash}.json`,
    cacheFileText: `${CACHE_PATH}/askAI-${hash}.txt`,
  };
}

/**
 * Checks for a cache hit. Runs test assertions and verbose logging on a hit.
 * Returns `null` on a miss.
 */
export function readCache(
  cacheFileJSON: string,
  cacheFileText: string,
  options: {
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    verbose?: boolean;
  },
): { response: unknown; isJson: boolean } | null {
  if (existsSync(cacheFileJSON)) {
    const response = JSON.parse(readFileSync(cacheFileJSON, "utf-8"));
    if (options.verbose) {
      console.log("\nReturning cached JSON response.");
    }
    if (options.test) {
      if (Array.isArray(options.test)) {
        options.test.forEach((test) => test(response));
      } else {
        options.test(response);
      }
    }
    if (options.verbose) {
      console.log("\nResponse:");
      console.log(response);
    }
    return { response, isJson: true };
  }

  if (existsSync(cacheFileText)) {
    const response = readFileSync(cacheFileText, "utf-8");
    if (options.verbose) {
      console.log("\nReturning cached text response.");
    }
    if (options.test) {
      if (Array.isArray(options.test)) {
        options.test.forEach((test) => test(response));
      } else {
        options.test(response);
      }
    }
    if (options.verbose) {
      console.log("\nResponse:");
      console.log(response);
    }
    return { response, isJson: false };
  }

  if (options.verbose) {
    console.log("\nCache missed. Generating new response...");
  }
  return null;
}

/**
 * Writes a response to the cache as JSON or plain text.
 */
export function writeCache(
  cacheFileJSON: string,
  cacheFileText: string,
  response: unknown,
  parseJson: boolean,
  verbose?: boolean,
): void {
  if (parseJson) {
    writeFileSync(cacheFileJSON, JSON.stringify(response));
    verbose && console.log("\nResponse cached as JSON.");
  } else {
    writeFileSync(cacheFileText, JSON.stringify(response));
    verbose && console.log("\nResponse cached as text.");
  }
}
