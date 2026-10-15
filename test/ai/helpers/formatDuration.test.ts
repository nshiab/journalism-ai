import { test } from "vite-plus/test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import formatDuration from "../../../src/ai/helpers/formatDuration.ts";

test("formats durations in milliseconds or seconds", () => {
  assertEquals(formatDuration(750), "750 ms");
  assertEquals(formatDuration(1_500), "1.5 s");
  assertEquals(formatDuration(90_000), "90 s");
});
