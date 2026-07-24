import crypto from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const CACHE_PATH = "./.journalism-cache";

/**
 * Initialises the cache directory and returns a deterministic file path
 * derived from a SHA-256 hash of the request parameters.
 */
export function initCache(
  hashInput: unknown,
): { cacheFile: string } {
  if (!existsSync(CACHE_PATH)) {
    mkdirSync(CACHE_PATH);
  }
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashInput))
    .digest("hex");
  return { cacheFile: `${CACHE_PATH}/askAI-${hash}.json` };
}

/**
 * Checks for a cache hit. Returns the cached value or `null` on a miss.
 */
export function readCache(
  cacheFile: string,
): unknown | null {
  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, "utf-8"));
  }
  return null;
}

/**
 * Writes a response to the cache.
 */
export function writeCache(
  cacheFile: string,
  response: unknown,
): void {
  writeFileSync(cacheFile, JSON.stringify(response));
}

/**
 * Reads a cached object and optionally transforms its `response`. If the
 * transform rejects the cached value, the cache entry is removed so a retry
 * can generate a fresh response.
 */
export async function readAndProcessCache<
  TCached extends { response: unknown },
  TResponse = TCached["response"],
>(
  cacheFile: string,
  processResponse?: (response: unknown) => TResponse | Promise<TResponse>,
): Promise<
  | (Omit<TCached, "response"> & { response: TResponse })
  | null
> {
  const cached = readCache(cacheFile) as TCached | null;
  if (cached === null) {
    return null;
  }
  if (!processResponse) {
    return cached as Omit<TCached, "response"> & { response: TResponse };
  }

  try {
    return {
      ...cached,
      response: await processResponse(cached.response),
    };
  } catch (error) {
    rmSync(cacheFile);
    throw error;
  }
}
