const cache = new Map();
export async function createSpeech(
  text,
  {
    key = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY,
    voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb",
    model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    request = fetch,
  } = {},
) {
  if (typeof text !== "string" || !text.trim() || text.length > 10000)
    throw Error("Speech text must contain 1–10,000 characters.");
  if (!key)
    throw Error(
      "ElevenLabs is not configured. Add ELEVENLABS_API_KEY and restart the server.",
    );
  const id = JSON.stringify([voice, model, text]);
  if (cache.has(id)) return cache.get(id);
  const response = await request(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok)
    throw Error(
      response.status === 401 || response.status === 403
        ? "ElevenLabs rejected the key or voice permissions. Check Text to Speech access and your selected voice."
        : response.status === 429
          ? "ElevenLabs usage limit reached. Try again later."
          : "ElevenLabs could not generate speech. Check your account credits and voice settings.",
    );
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) throw Error("ElevenLabs returned no audio.");
  if (cache.size >= 20) cache.delete(cache.keys().next().value);
  cache.set(id, audio);
  return audio;
}
