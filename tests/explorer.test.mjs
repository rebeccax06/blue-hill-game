import {
  sectionIllustration,
  sectionIllustrationProfile,
} from "../public/section-illustration.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { Readable } from "node:stream";
import { handler } from "../server.mjs";
const publicRoot = new URL("../public/", import.meta.url);
const data = JSON.parse(
  await readFile(new URL("explorer/sections.json", publicRoot)),
);

test("section guide covers the entire source corridor, preserves local facts, and links every rendering", async () => {
  assert.equal(data.sections.length, 20);
  assert.match(data.sections[0].title, /River St/);
  assert.match(data.sections.at(-1).title, /Warren St/);
  assert.match(
    data.sections[11].topics.find((t) => t.label === "Parking").text,
    /increase of 5 parking spaces.*carriageway/,
  );
  assert.match(
    data.sections[19].topics.find((t) => t.label === "Walking & biking").text,
    /no bike lanes/,
  );
  const linked = new Set();
  for (const [index, section] of data.sections.entries()) {
    assert.equal(section.page, index + 1);
    assert.equal(section.topics.length, 6);
    assert.ok(section.topics.every((t) => t.text.trim()));
    assert.ok(section.plan.width > 500 && section.plan.height > 300);
    assert.equal(section.drawing, section.plan.original);
    assert.equal(section.plan.layers.length, 5);
    for (const layer of section.plan.layers)
      await access(new URL(layer.image.slice(1), publicRoot));
    for (const file of [section.drawing, section.slide, section.plan.clear])
      await access(new URL(file.slice(1), publicRoot));
    section.renderings.forEach((id) => linked.add(id));
  }
  assert.equal(data.renderings.length, 9);
  assert.deepEqual(linked, new Set(data.renderings.map((r) => r.id)));
  for (const rendering of data.renderings)
    await access(new URL(rendering.image.slice(1), publicRoot));
});

test("project assets are served with browser image/PDF types while source notes remain private", async () => {
  for (const [url, expectedStatus, type] of [
    ["/explorer.js", 200, "text/javascript"],
    ["/street-three.js", 200, "text/javascript"],
    ["/vendor/three/three.module.js", 200, "text/javascript"],
    ["/vendor/three/OrbitControls.js", 200, "text/javascript"],
    ["/explorer/sections.json", 200, "application/json"],
    [data.sections[0].drawing, 200, "image/webp"],
    [data.sections[0].plan.layers[0].image, 200, "image/png"],
    [data.sources.blocks.url, 200, "application/pdf"],
    [data.sources.renderings.url, 200, "application/pdf"],
    ["/info/Reddit comments BHA.xlsx", 404, "application/json"],
  ]) {
    const req = Object.assign(Readable.from([]), {
      url,
      method: "GET",
      headers: {},
    });
    let status, headers;
    await handler(req, {
      writeHead(s, h) {
        status = s;
        headers = h;
      },
      end() {},
    });
    assert.equal(status, expectedStatus);
    assert.equal(headers["Content-Type"], type);
  }
});

test("illustrations preserve section-specific cycling and traffic differences and make feature highlights visible", () => {
  assert.equal(sectionIllustrationProfile(data.sections[0]).cycling, "none");
  assert.equal(sectionIllustrationProfile(data.sections[11]).cycling, "bike");
  assert.equal(sectionIllustrationProfile(data.sections[19]).cycling, "none");
  assert.equal(sectionIllustrationProfile(data.sections[16]).northbound, 3);
  assert.equal(
    sectionIllustrationProfile(data.sections[10]).eastParking,
    false,
  );
  assert.equal(sectionIllustrationProfile(data.sections[11]).carriageway, true);
  assert.equal(
    new Set(data.sections.map((s) => sectionIllustration(s))).size,
    20,
  );
  const section = data.sections[11];
  const all = sectionIllustration(section);
  const retained = sectionIllustration(section, "blue");
  assert.notEqual(all, retained);
  assert.match(retained, /data-illustrated-feature="blue" opacity="1"/);
  assert.match(retained, /data-illustrated-feature="bus" opacity="0.16"/);
  assert.match(retained, /SCHEMATIC/);
  assert.match(
    sectionIllustration(section, "red"),
    /Use the source drawing for the affected locations/,
  );
});

test("Happy Supermarket model retains source coordinates, curved bus boundaries and all highlight groups", async () => {
  const model = JSON.parse(
    await readFile(new URL("explorer/street-12.json", publicRoot)),
  );
  assert.equal(model.sourcePage, 12);
  assert.equal(model.width, data.sections[11].plan.width);
  assert.equal(model.height, data.sections[11].plan.height);
  assert.deepEqual(
    model.features.map((f) => f.id),
    data.sections[11].plan.layers.map((f) => f.id),
  );
  assert.ok(
    model.features
      .find((f) => f.id === "bus")
      .polygons.some((p) => p.length > 8),
  );
  assert.ok(model.carriageway.length > 4);
  for (const feature of model.features)
    for (const polygon of feature.polygons) {
      assert.ok(polygon.length >= 3);
      for (const [x, y] of polygon)
        assert.ok(x >= 0 && y >= 0 && x <= model.width && y <= model.height);
    }
});
