import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  fresh,
  canFreeze,
  freeze,
  addAmendment,
  validPackage,
} from "../public/engine.js";
import { handler, generate } from "../server.mjs";
import { street, portrait } from "../public/art.js";
const C = JSON.parse(
  await readFile(new URL("../public/content.json", import.meta.url)),
);
function ready() {
  return {
    ...fresh(),
    initial: "B",
    priorities: [0, 1],
    people: ["Malik", "Denise", "Gloria"].map((name) => ({
      name,
      question: "What matters to you?",
      answer: "My experience",
      resolved: true,
    })),
    pressure: { response: "Keep B", reason: "I value reliable trips" },
    reflection: "Access also matters",
    final: { option: "C", amendments: [1, 11], confirmed: true },
    benefits: ["Bus riders", "People with long car trips", "Loading zones"],
    mitigationResolved: true,
  };
}
test("freeze requires exactly three distinct completed interviews and resolved follow-ups", () => {
  assert.equal(canFreeze(ready()), true);
  for (const mutate of [
    (s) => s.people.pop(),
    (s) => s.people.push(s.people[0]),
    (s) => (s.people[1].name = "Malik"),
    (s) => (s.people[0].resolved = false),
    (s) => (s.people[0].answer = ""),
    (s) => (s.experts = Array(4).fill(s.people[0])),
  ]) {
    const s = ready();
    mutate(s);
    assert.equal(canFreeze(s), false);
    assert.throws(() => freeze(s));
  }
});
test("freeze checks every reflection, mitigation review, and current package", () => {
  for (const mutate of [
    (s) => s.benefits.pop(),
    (s) => (s.benefits[1] = " "),
    (s) => (s.mitigationResolved = false),
    (s) => (s.final.confirmed = false),
    (s) => (s.final.amendments = [1, 2, 3]),
    (s) => (s.final.amendments = [1, 1]),
    (s) => (s.final.amendments = [14]),
    (s) => (s.final.option = "D"),
    (s) => (s.pressure.reason = null),
    (s) => (s.reflection = null),
    (s) => (s.priorities = [0, 0]),
  ]) {
    const s = ready();
    mutate(s);
    assert.equal(canFreeze(s), false);
  }
});
test("freezing snapshots package and amendments are capped at two", () => {
  const s = ready(),
    f = freeze(s);
  s.final.amendments.pop();
  assert.deepEqual(f.amendments, [1, 11]);
  assert.equal(s.frozen, true);
  assert.throws(() => addAmendment([1, 2], 3));
  assert.deepEqual(addAmendment([1, 2], 1), [2]);
  for (const option of ["A", "B", "C"])
    assert.ok(validPackage({ option, amendments: [11, 13] }));
});
test("source contains complete rosters, menus, priorities, and only branch-specific pressure content", () => {
  assert.equal(C.people.length, 8);
  assert.equal(C.experts.length, 6);
  assert.equal(C.amendments.length, 13);
  assert.equal(C.priorities.length, 13);
  assert.equal(C.events.A.choices.length, 4);
  assert.equal(C.events.C.choices.length, 5);
  for (const p of [...C.people, ...C.experts])
    assert.ok(p.intro && p.description && p.guidance);
  assert.match(C.events.B.story, /displacement/);
  assert.doesNotMatch(C.events.A.story, /SHOW US THE REAL PLAN/);
});
test("illustrations change with options and visual amendments", () => {
  assert.notEqual(street("A"), street("B"));
  assert.notEqual(street("B"), street("C"));
  assert.match(street("B"), /data-lane="Bike"/);
  assert.doesNotMatch(street("A"), /data-lane="Bus"/);
  assert.notEqual(street("A", [1, 6]), street("A"));
  assert.notEqual(portrait(0), portrait(1));
});
async function request(url, method = "GET", body, headers = {}) {
  const req = Readable.from(
    body === undefined
      ? []
      : [typeof body === "string" ? body : JSON.stringify(body)],
  );
  Object.assign(req, { url, method, headers });
  let status, head, result;
  const res = {
    writeHead(s, h) {
      status = s;
      head = h;
    },
    end(x) {
      result = x;
    },
  };
  await handler(req, res);
  return { status, headers: head, body: String(result ?? "") };
}
test("server serves app modules and rejects missing and private files", async () => {
  for (const f of [
    "/",
    "/app.js",
    "/engine.js",
    "/art.js",
    "/content.json",
    "/style.css",
    "/markdown.js",
    "/vendor/markdown-it.min.js",
  ])
    assert.equal((await request(f)).status, 200);
  assert.equal((await request("/.env")).status, 404);
  assert.equal((await request("/missing")).status, 404);
  assert.equal((await request("/x", "DELETE")).status, 405);
  assert.equal(
    (
      await request(
        "/api/generate",
        "POST",
        {},
        { origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
  assert.equal((await request("/api/generate", "POST", "{bad")).status, 502);
});
test("offline mode is explicitly labeled and endings use final option and amendments", async (t) => {
  const status = JSON.parse((await request("/api/status")).body);
  if (status.ai)
    return t.skip(
      "Live AI configured; avoid invoking paid generation in tests",
    );
  const answer = await generate({
    kind: "dialogue",
    person: "Malik",
    question: "How does the bus affect your day?",
  });
  assert.equal(answer.mode, "offline");
  assert.match(answer.text, /prerecorded/);
  await assert.rejects(
    () => generate({ kind: "ending", state: ready() }),
    /not ready/,
  );
  const s = ready();
  freeze(s);
  const ending = await generate({ kind: "ending", state: s });
  assert.match(ending.text, /Center-running transit/);
  assert.match(ending.text, /housing-stability/);
  assert.match(ending.text, /access/);
  assert.doesNotMatch(ending.text, /A fourth option/);
});
