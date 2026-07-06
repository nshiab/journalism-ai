/**
 * Parses JSON (if requested) and returns the parsed response.
 */
export function processResponse(
  returnedResponse: unknown,
  options: {
    parseJson?: boolean;
  },
): unknown {
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
  }

  return parsed;
}
