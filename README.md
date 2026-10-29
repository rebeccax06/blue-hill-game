# Blue Hill Avenue: Who Gets the Street?

An interactive implementation of the Bluehill Avenue game.

## Run locally

Requires Node.js 22.9 or later.

```sh
npm install
npm run dev
```

Open the URL printed in your terminal (normally **http://localhost:3000**). If the port is occupied, the server automatically tries the next available port, up to 20 ports. You can set the starting port with `PORT=3001 npm run dev`.

## Enable AI dialogue

Copy the example configuration and add your own API key:

```sh
cp .env.example .env
```

Edit `.env`:

```dotenv
CLAUDE_API_KEY=your-key-here
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3000
```

Restart the server. The street panel will say **Claude dialogue connected**. The key stays on the server; never put it in a browser file. The implementation uses the [Claude Messages API](https://platform.claude.com/docs/en/api/messages/create). The model is configurable with CLAUDE_MODEL. ANTHROPIC_API_KEY is also accepted.

Without a key, the game runs in **offline preview mode**. Characters explicitly share prerecorded introductions rather than claiming to generate answers. Synthesis and outcomes are assembled from the source and actual recorded choices. Live API calls were not tested without a configured key.

## Text and voice

Turn the **Voice** switch on to reveal **Start microphone** and **Read aloud**. Turning it off stops listening and playback. Start the microphone to dictate into the current answer or say “choose option A”, B, or C when design cards are visible. Review and confirm or send manually; text remains editable.

Read aloud uses ElevenLabs through the local server. Set `ELEVENLABS_API_KEY` in `.env` (`ELEVEN_LABS_API_KEY` is also accepted), then restart the server. Optional `ELEVENLABS_VOICE_ID` selects a voice. `ELEVENLABS_MODEL` defaults to `eleven_multilingual_v2`. The API key needs Text to Speech access. Narration text is sent to ElevenLabs; up to 20 generated clips are cached in server memory to avoid repeated charges. The key stays on the server.

Microphone input uses browser speech recognition without a paid transcription API. It requires a supporting browser, microphone permission, and localhost or HTTPS. The app does not record or store audio; dictated text becomes part of saved answers. Unsupported browsers retain typing and ElevenLabs playback. Real microphone and speaker behavior needs manual testing on the target devices.

## Section explorer

Choose **Explore the avenue** on the welcome screen or in the header. Select any of the 20 numbered blocks on the clickable corridor diagram, or search by street/landmark. The explorer opens at section 12, Harvard Street to Vesta Road / Happy Supermarket(currently only section with 3d rendering). Click model features or use Overview, Street level, and Top view cameras.

Use Street sketch, Clear plan, or Aerial context to compare views. Street sketch is an approximate illustrated interpretation. The street perspective follows the section’s documented lane and cycling arrangement, with feature toggles that spotlight parking, bus lanes, trees, bike space, and platforms. Buildings, widths, and object placement are schematic; lane arrangements can vary within the section. Switch to Clear plan or Aerial context for the exact source geometry. Zoom, drag to pan, switch to aerial context, and highlight source colors for bus lanes, green markings, platforms/daylighting, or parking changes. Keyboard controls: +/− to zoom, 0 to fit, arrows to pan. Touch supports dragging and two-finger pinch zoom.

The complete embedded drawings are extracted directly from the September 2026 PDF, including areas covered by slide legends. The clear view reduces faded aerial detail and emphasizes original linework; it preserves the drawing geometry. Color matching is a visual aid, not semantic reconstruction: green combines bike space, trees, and added parking, and yellow combines platforms and daylighting. The original drawing, full source slide with its legend, and related existing/proposed renderings remain available alongside.

All rendered assets and metadata are included in `public/explorer/`. The Three.js runtime is installed with `npm install` and served locally from a small explicit module allowlist; no CDN or external model service is needed. To regenerate after replacing the source PDFs in `info/`, run `python3 scripts/build-explorer.py` with PyMuPDF, Pillow, and NumPy installed. This also runs `scripts/build-plan-assets.py` to recover the complete drawings and create high-contrast plans and source-color highlight masks. Run `python3 scripts/build-street-model.py` (also requires SciPy) to regenerate the section-12 model from the source-color masks. Colored boundaries are traced and simplified within 1.5 source pixels; context footprints are manually interpreted, and heights, tree shapes, and vehicle dimensions are illustrative rather than surveyed. The prototype is not a CAD model.

## Included

- The three defensible base options, thirteen starting priorities, eight residents, six optional experts, and thirteen authorized amendments from the source document.
- Responsive, original SVG street illustrations with perspective views, labeled callouts, proportional street-space strips, lane explanations, and selected physical amendment markers. Both major-redesign illustrations retain bike space; C visibly allocates more room to parking and loading, while B has more bike and public space. T
- Illustrated characters, player-authored questions, AI responses grounded in the specification, and one optional follow-up per consultation.
- Three distinct resident interviews, zero to three experts, initial-option-specific public pressure, personalized synthesis, final recommendation, sequential benefit/cost questions, and mandatory review of proposed changes before implementation.
- An animated before/after street reveal at Five Years Later, with replay, a manual slider, and reduced-motion support in perspective view.
- Balanced five-year outcomes based on the frozen final package, followed by four sequential feedback prompts. No scores, winning option, votes, or persuasion meters.
- Browser-local progress, a field notebook, downloadable notes, and an explicit restart confirmation.

The interface makes selections through buttons rather than requiring conversational parsing of policy names. During mitigation review, the player explicitly chooses whether to revise the package; suggested amendments are never automatically added. AI generation controls prose, while application logic controls stage transitions and completion gates.

## Data and privacy

Progress and notes are saved in this browser's local storage. AI mode sends the question and relevant game context through the local server to Claude. Ending generation receives only the final package, so interview choices and reflections do not determine outcomes. There is no research database, analytics, or submission to Boston or the MBTA. The optional Google Fonts stylesheet can be removed for a fully local offline presentation; system font fallbacks are provided.

## Validation

```sh
npm test
```

Tests cover completion gates, unresolved follow-ups, the two-amendment cap, frozen-package snapshots, content completeness, visual variations, static/API routes, and transparent offline behavior. The section explorer was also checked in headless Chrome at desktop and mobile widths. Run `node scripts/qa-explorer.mjs` for the browser checks; set `CHROME_PATH` if Chrome is installed elsewhere. Screenshots are saved in your system temporary directory.

Source text: `data/specification.txt`. Browser content: `public/content.json`. Original Word file is not required at runtime.
