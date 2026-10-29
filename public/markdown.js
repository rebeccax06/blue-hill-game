import "./vendor/markdown-it.min.js";

const markdown = new globalThis.markdownit({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false,
});

// Keep AI prose in the page's heading hierarchy and preserve the surrounding
// game styling. The library handles nesting, escaping, and link validation.
markdown.core.ruler.push("game_heading_levels", (state) => {
  for (const token of state.tokens) {
    if (token.type === "heading_open" || token.type === "heading_close") {
      token.tag = `h${Math.max(3, Number(token.tag.slice(1)))}`;
    }
  }
});

// Responses may contain Markdown image syntax; show its description without
// fetching remote images or introducing unexpected artwork into the dialogue.
markdown.renderer.rules.image = (tokens, index) =>
  markdown.utils.escapeHtml(tokens[index].content);

export function renderMarkdown(value) {
  return markdown.render(String(value ?? ""));
}
