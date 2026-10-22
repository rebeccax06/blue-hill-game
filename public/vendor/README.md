# markdown-it

`markdown-it.min.js` is the unmodified browser bundle from **markdown-it 14.1.0**, distributed under the included MIT license.

Source: https://github.com/markdown-it/markdown-it/tree/14.1.0
Package file: `markdown-it@14.1.0/dist/markdown-it.min.js`

Vendored so the buildless browser app works without a CDN or dependency installation. The bundle exposes `globalThis.markdownit`; `../markdown.js` imports it and configures the renderer. To upgrade, replace the bundle and license together, then run `npm test`.
