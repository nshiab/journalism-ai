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
    } catch (_error) {
      const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = String(parsed).match(markdownRegex);

      if (match && match[1]) {
        try {
          return JSON.parse(match[1].trim());
        } catch (error) {
          const displayResponse = parsed === ""
            ? "[empty string]"
            : String(parsed);
          throw new Error(
            `Failed to parse response as JSON: ${error}.\nResponse: ${displayResponse}`,
          );
        }
      }

      const displayResponse = parsed === "" ? "[empty string]" : String(parsed);
      throw new Error(
        `Failed to parse response as JSON: ${_error}.\nResponse: ${displayResponse}`,
      );
    }
  }

  return parsed;
}
