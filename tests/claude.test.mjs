import test from "node:test";
import assert from "node:assert/strict";
import { requestClaude, DEFAULT_MODEL } from "../claude.mjs";

test("Claude uses chat messages, server-side API key auth, and reads final content", async () => {
  let request;
  const text = await requestClaude({
    key: "test-key",
    instructions: "Follow the game rules.",
    input: { question: "How does this affect you?" },
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return Response.json({
        content: [
          { type: "thinking", thinking: "Do not display this." },
          { type: "text", text: "My bus trips matter." },
        ],
        stop_reason: "end_turn",
      });
    },
  });
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.options.headers["x-api-key"], "test-key");
  assert.equal(request.body.model, DEFAULT_MODEL);
  assert.equal(request.body.system, "Follow the game rules.");
  assert.equal(request.options.headers["anthropic-version"], "2023-06-01");
  assert.equal(request.body.messages[0].role, "user");
  assert.deepEqual(JSON.parse(request.body.messages[0].content), {
    question: "How does this affect you?",
  });
  assert.equal(request.body.max_tokens, 1100);
  assert.equal(request.body.stream, false);
  assert.equal(text, "My bus trips matter.");
});
test("Claude honors model overrides and reports auth, rate limits, empty and truncated responses", async () => {
  await requestClaude({
    key: "test",
    model: "custom-model",
    instructions: "Rules",
    input: {},
    fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).model, "custom-model");
      return Response.json({ content: [{ type: "text", text: "Response" }] });
    },
  });
  for (const [status, message] of [
    [401, /CLAUDE_API_KEY/],
    [429, /rate limited/],
    [503, /unavailable/],
  ])
    await assert.rejects(
      () =>
        requestClaude({
          key: "test",
          fetchImpl: async () => new Response("", { status }),
        }),
      message,
    );
  for (const [body, message] of [
    [{ content: [] }, /No Claude response/],
    [{ content: [{ type: "text", text: " " }] }, /No Claude response/],
    [
      {
        stop_reason: "max_tokens",
        content: [{ type: "text", text: "Incomplete" }],
      },
      /cut short/,
    ],
  ])
    await assert.rejects(
      () =>
        requestClaude({
          key: "test",
          fetchImpl: async () => Response.json(body),
        }),
      message,
    );
});
