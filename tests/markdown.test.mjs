import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown} from '../public/markdown.js';

test('AI mitigation response renders bold and nested lists as semantic HTML',()=>{
 const html=renderMarkdown(`Your answers touch on possible amendments.\n\n**Possible correspondences I see:**\n\n- **"a targeted approach"** could match **5 — Stronger bus priority**.\n\n- **Two things in earlier answers:**\n  - Andre raised loading spots → **1 — Targeted loading zones**.\n  - Raymond raised public reporting → **12 — Accountability**.\n\n- **No base-option change:** nothing suggests switching.`);
 assert.match(html,/<p><strong>Possible correspondences I see:<\/strong><\/p>/);
 assert.equal((html.match(/<ul>/g)||[]).length,2);
 assert.equal((html.match(/<li>/g)||[]).length,5);
 assert.match(html,/<li><p><strong>Two things in earlier answers:<\/strong><\/p><ul>/);
 assert.doesNotMatch(html,/\*\*/);
});
test('headings, ordered lists, code, quotes and paragraphs render without exposing HTML',()=>{
 const html=renderMarkdown('### Summary\n\nFirst paragraph.\n\n3. **Benefit**\n4. *Cost*\n\n> A perspective\n\n`**literal**`\n\n```html\n<img src=x onerror=alert(1)>\n```');
 assert.match(html,/<h3>Summary<\/h3>/);assert.match(html,/<ol start="3">/);assert.match(html,/<em>Cost<\/em>/);assert.match(html,/<blockquote>/);assert.match(html,/<code>\*\*literal\*\*<\/code>/);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('raw HTML is escaped and unsafe link protocols cannot create executable links',()=>{
 const html=renderMarkdown('<script>alert(1)</script>\n\n[unsafe](javascript:alert) [encoded](java&#x73;cript:alert) [safe](https://example.com/?a=1&b=2)');
 assert.doesNotMatch(html,/<script|href="javascript|href="java&#/i);assert.match(html,/&lt;script&gt;/);assert.equal((html.match(/<a /g)||[]).length,1);assert.match(html,/href="https:\/\/example.com\/\?a=1&amp;b=2"/);
});
