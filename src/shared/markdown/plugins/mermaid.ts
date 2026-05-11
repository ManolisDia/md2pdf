import type MarkdownIt from "markdown-it";

/**
 * Replaces fenced code blocks with info string `mermaid` with a
 * <pre class="mermaid"> element so the runtime (browser or Puppeteer)
 * can render it to SVG via mermaid.run().
 */
export function mermaidBlocks(md: MarkdownIt): void {
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const tok = tokens[idx];
    const info = tok.info.trim().toLowerCase();
    if (info === "mermaid") {
      const code = tok.content;
      return `<pre class="mermaid">${escapeHtml(code)}</pre>\n`;
    }
    return defaultFence ? defaultFence(tokens, idx, opts, env, self) : self.renderToken(tokens, idx, opts);
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
