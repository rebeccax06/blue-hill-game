import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { featuresForBlock, blockFeatures } from "../public/block-play.js";
const { sections } = JSON.parse(
  await readFile(new URL("../public/explorer/sections.json", import.meta.url)),
);

test("in-game feature cards use each selected block's own proposal notes", () => {
  for (const block of sections) {
    const features = featuresForBlock(block);
    assert.equal(features.length, 6);
    assert.deepEqual(
      features.map((f) => f.id),
      blockFeatures.map((f) => f.id),
    );
    if (block.number === 12) {
      assert.equal(features, blockFeatures);
      assert.equal(features[0].layer, "platforms");
      continue;
    }
    for (const feature of features) {
      const text = block.topics[feature.topic].text;
      assert.ok(text.startsWith(feature.summary.replace(/…$/, "")));
      assert.ok(feature.question.includes(block.title));
      assert.ok(feature.people.length && feature.amendments.length);
      assert.notEqual(feature.layer, "platforms");
    }
    assert.equal(features[0].label, "Bus stops");
    assert.equal(features[1].label, "Parking & loading");
    assert.equal(features[0].layer, "bus");
  }
});
