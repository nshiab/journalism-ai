import { test } from "vite-plus/test";
import { deepStrictEqual as assertEquals, throws as assertThrows } from "node:assert/strict";
import { processResponse } from "../../../src/ai/helpers/processResponse.ts";

test("processResponse parses raw JSON when requested", () => {
  const response = processResponse('{"name":"Alice"}', { parseJson: true });

  assertEquals(response, { name: "Alice" });
});

test("processResponse parses fenced JSON when raw parsing fails", () => {
  const response = processResponse('```json\n{"name":"Alice"}\n```', {
    parseJson: true,
  });

  assertEquals(response, { name: "Alice" });
});

test("processResponse throws when requested JSON cannot be parsed", () => {
  assertThrows(
    () => processResponse("not json", { parseJson: true }),
    /Failed to parse response as JSON/,
  );
});

test("processResponse returns strings unchanged when JSON parsing is not requested", () => {
  const response = processResponse("not json", {});

  assertEquals(response, "not json");
});
