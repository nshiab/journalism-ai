/**
 * Parses JSON (if requested), applies the optional clean function, and runs
 * test assertions. Returns both the cleaned response and the raw
 * (pre-clean, post-parse) value.
 */
export function processResponse(
  returnedResponse: unknown,
  options: {
    parseJson?: boolean;
    clean?: (response: unknown) => unknown;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    verbose?: boolean;
  },
): { cleaned: unknown; raw: unknown } {
  let parsed: unknown = returnedResponse;

  if (options.parseJson) {
    try {
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
    } catch (error) {
      const displayResponse = parsed === "" ? "[empty string]" : String(parsed);
      throw new Error(
        `Failed to parse response as JSON: ${error}.\nResponse: ${displayResponse}`,
      );
    }

    if (options.verbose) {
      console.log("\nParsed JSON response:");
      console.log(parsed);
    }
  }

  const raw = parsed;
  const cleaned = options.clean ? options.clean(parsed) : parsed;

  if (options.test) {
    if (Array.isArray(options.test)) {
      options.test.forEach((test) => test(cleaned));
    } else {
      options.test(cleaned);
    }
  }

  if (options.verbose && options.clean) {
    console.log("\nCleaned response:");
    console.log(cleaned, "\n");
  }

  return { cleaned, raw };
}
