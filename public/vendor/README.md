# markdown-it

`markdown-it.min.js` is the unmodified browser bundle from **markdown-it 14.1.0**, distributed under the included MIT license.

Source: https://github.com/markdown-it/markdown-it/tree/14.1.0
Package file: `markdown-it@14.1.0/dist/markdown-it.min.js`

Vendored so the buildless browser app works without a CDN or dependency installation. The bundle exposes `globalThis.markdownit`; `../markdown.js` imports it and configures the renderer. To upgrade, replace the bundle and license together, then run `npm test`.

## Three.js

Three.js is an npm dependency (MIT license in `node_modules/three/LICENSE`), pinned by `package-lock.json`. The server exposes only `three.module.js`, `three.core.js`, and the `OrbitControls` addon under `/vendor/three/`; it does not expose arbitrary files from `node_modules`. The HTML import map resolves the `three` module locally. The first Three.js model is the Happy Supermarket section in `../street-three.js`.
