import test from "node:test";
import assert from "node:assert/strict";
import { createSpeech } from "../speech.mjs";

test("speech uses server credentials, returns audio, and caches repeated narration", async () => {
  let calls = 0;
  const options = {
    key: "test-secret",
    voice: "test-voice",
    request: async (url, init) => {
      calls++;
      assert.match(url, /text-to-speech\/test-voice/);
      assert.equal(init.headers["xi-api-key"], "test-secret");
      assert.equal(JSON.parse(init.body).model_id, "eleven_multilingual_v2");
      return new Response(new Uint8Array([1, 2, 3]));
    },
  };
  assert.deepEqual(
    await createSpeech("Test narration.", options),
    Buffer.from([1, 2, 3]),
  );
  await createSpeech("Test narration.", options);
  assert.equal(calls, 1);
});

test("speech rejects invalid input and reports permission failures without exposing secrets", async () => {
  await assert.rejects(createSpeech("", { key: "secret" }), /1–10,000/);
  await assert.rejects(createSpeech("hello", { key: "" }), /not configured/);
  await assert.rejects(
    createSpeech("permission test", {
      key: "secret",
      request: async () =>
        new Response("private upstream error", { status: 401 }),
    }),
    /key or voice permissions/,
  );
});

test("speech distinguishes quota exhaustion from authentication and permissions", async () => {
  for (const [code, message] of [
    ["quota_exceeded", /usage allowance is exhausted/],
    ["invalid_api_key", /rejected the API key/],
    ["missing_permissions", /missing Text to Speech permission/],
    ["voice_not_found", /voice is unavailable/],
  ]) {
    await assert.rejects(
      createSpeech(`diagnose ${code}`, {
        key: "test-secret",
        request: async () =>
          new Response(
            JSON.stringify({
              detail: { status: code, message: "private upstream details" },
            }),
            { status: 401 },
          ),
      }),
      (error) =>
        message.test(error.message) &&
        !error.message.includes("private upstream details"),
    );
  }
});
