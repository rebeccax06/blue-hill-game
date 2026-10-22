# Blue Hill Avenue: Who Gets the Street?

An interactive implementation of the Bluehill Avenue game. 

## Run locally

Requires Node.js 22.9 or later.

```sh
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
DEEPSEEK_API_KEY=your-key-here
DEEPSEEK_MODEL=deepseek-flash
PORT=3000
```

Restart the server. The street panel will say **DeepSeek dialogue connected**. The key stays on the server; never put it in a browser file. The implementation uses the [DeepSeek Chat Completions API](https://api-docs.deepseek.com/). The model is configurable.

Without a key, the game runs in **offline preview mode**. Characters explicitly share prerecorded introductions rather than claiming to generate answers. Synthesis and outcomes are assembled from the source and actual recorded choices. Live API calls were not tested without a configured key.

## Included

- The three defensible base options, thirteen starting priorities, eight residents, six optional experts, and thirteen authorized amendments from the source document.
- Responsive, original SVG street illustrations with perspective/top views, labeled callouts, proportional street-space strips, lane explanations, and selected physical amendment markers. Both major-redesign illustrations retain bike space; C visibly allocates more room to parking and loading, while B has more bike and public space. These are schematic illustrations inspired by the linked 3DStreet concept, not an embedded 3DStreet editor or engineering plans. They do not imply actual dimensions or lane counts. Social-policy amendments are recorded in the package rather than represented as invented buildings or visible guarantees.
- Illustrated characters, player-authored questions, AI responses grounded in the specification, and one optional follow-up per consultation.
- Three distinct resident interviews, zero to three experts, initial-option-specific public pressure, personalized synthesis, final recommendation, sequential benefit/cost questions, and mandatory review of proposed changes before implementation.
- An animated before/after street reveal at Five Years Later, with replay, a manual slider, and reduced-motion support in both perspective and top views.
- Balanced five-year outcomes based on the frozen final package, followed by four sequential feedback prompts. No scores, winning option, votes, or persuasion meters.
- Browser-local progress, a field notebook, downloadable notes, and an explicit restart confirmation.

The interface makes selections through buttons rather than requiring conversational parsing of policy names. During mitigation review, the player explicitly chooses whether to revise the package; suggested amendments are never automatically added. AI generation controls prose, while application logic controls stage transitions and completion gates.

## Data and privacy

Progress and notes are saved in this browser's local storage. AI mode sends the question and relevant game context through the local server to DeepSeek. Ending generation receives only the final package, so interview choices and reflections do not determine outcomes. There is no research database, analytics, or submission to Boston or the MBTA. The optional Google Fonts stylesheet can be removed for a fully local offline presentation; system font fallbacks are provided.

## Validation

```sh
npm test
```

Tests cover completion gates, unresolved follow-ups, the two-amendment cap, frozen-package snapshots, content completeness, visual variations, static/API routes, and transparent offline behavior. Browser visual QA could not run in the authoring sandbox because opening a local listening port was blocked. Run locally to review the experience at desktop and mobile widths.

Source text: `data/specification.txt`. Browser content: `public/content.json`. Original Word file is not required at runtime.
