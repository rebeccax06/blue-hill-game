import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { relatedComments } from "../public/discussion.js";
const index = JSON.parse(
  await readFile(new URL("../public/comment-index.json", import.meta.url)),
);
test("all source comments have stable rows and searchable text", () => {
  assert.equal(index.comments.length, 232);
  assert.equal(new Set(index.comments.map((c) => c.id)).size, 232);
  assert.ok(index.comments.every((c) => c.row > 1 && c.text && c.thread));
});
test("resident evidence reflects relevant topics and questions", () => {
  const matches = relatedComments(index, "Gloria", "rent landlord", 4);
  assert.equal(matches.length, 4);
  assert.ok(
    matches.every((c) =>
      c.topics.some((t) =>
        [
          "Displacement",
          "Affordability",
          "Gentrification",
          "Neighborhood identity",
        ].includes(t),
      ),
    ),
  );
  assert.deepEqual(relatedComments(index, "unknown"), []);
});
