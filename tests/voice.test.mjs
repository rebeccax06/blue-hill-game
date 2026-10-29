import test from "node:test";
import assert from "node:assert/strict";
import { parseSpokenOption } from "../public/voice.js";

test("recognizes explicit option selections and common letter transcriptions", () => {
  for (const [text, expected] of [
    ["A", "A"],
    ["choose option B.", "B"],
    ["I choose C", "C"],
    ["select bee", "B"],
    ["option see", "C"],
  ]) {
    assert.equal(parseSpokenOption(text), expected);
  }
});

test("does not turn ambiguous reflections into option selections", () => {
  for (const text of [
    "I think B could help but C is better",
    "A or B",
    "do not choose A",
    "maybe option C",
    "",
  ]) {
    assert.equal(parseSpokenOption(text), null);
  }
});
