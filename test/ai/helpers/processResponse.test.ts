import { assertEquals, assertThrows } from "jsr:@std/assert";
import { processResponse } from "../../../src/ai/helpers/processResponse.ts";

Deno.test("processResponse parses raw JSON when requested", () => {
  const response = processResponse('{"name":"Alice"}', { parseJson: true });

  assertEquals(response, { name: "Alice" });
});

Deno.test("processResponse parses fenced JSON when raw parsing fails", () => {
  const response = processResponse('```json\n{"name":"Alice"}\n```', {
    parseJson: true,
  });

  assertEquals(response, { name: "Alice" });
});

Deno.test("processResponse throws when requested JSON cannot be parsed", () => {
  assertThrows(
    () => processResponse("not json", { parseJson: true }),
    Error,
    "Failed to parse response as JSON",
  );
});

Deno.test("processResponse returns strings unchanged when JSON parsing is not requested", () => {
  const response = processResponse("not json", {});

  assertEquals(response, "not json");
});