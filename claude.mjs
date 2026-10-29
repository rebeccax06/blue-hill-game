export const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function requestClaude({
  key,
  model = DEFAULT_MODEL,
  instructions,
  input,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system: instructions,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      max_tokens: 1100,
      stream: false,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw Error(
      response.status === 401 || response.status === 403
        ? "Claude key was rejected. Check CLAUDE_API_KEY in the server configuration."
        : response.status === 429
          ? "Claude is temporarily rate limited. Please retry."
          : "Claude is unavailable. Please retry.",
    );
  const result = await response.json();
  if (result.stop_reason === "max_tokens")
    throw Error("Claude’s response was cut short. Please retry.");
  const text = result.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw Error("No Claude response returned. Please retry.");
  return text;
}
