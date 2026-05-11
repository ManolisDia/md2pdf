import type MarkdownIt from "markdown-it";
import type { RuleInline } from "markdown-it/lib/parser_inline.mjs";

const WIKILINK_RE = /^\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/;
const EMBED_RE = /^!\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/;

export function wikilinks(md: MarkdownIt): void {
  const rule: RuleInline = (state, silent) => {
    const src = state.src.slice(state.pos);
    const isEmbed = src.charCodeAt(0) === 0x21 /* ! */;
    const re = isEmbed ? EMBED_RE : WIKILINK_RE;
    if (!isEmbed && src.charCodeAt(0) !== 0x5b /* [ */) return false;
    const m = re.exec(src);
    if (!m) return false;
    if (!silent) {
      const target = m[1].trim();
      const label = (m[2] ?? target).trim();
      if (isEmbed) {
        const tok = state.push("html_inline", "", 0);
        tok.content = `<span class="wikilink wikilink-embed" data-target="${escapeAttr(target)}">${escapeHtml(label)}</span>`;
      } else {
        const tok = state.push("html_inline", "", 0);
        const href = `#${slugify(target)}`;
        tok.content = `<a class="wikilink" href="${escapeAttr(href)}" data-target="${escapeAttr(target)}">${escapeHtml(label)}</a>`;
      }
    }
    state.pos += m[0].length;
    return true;
  };
  md.inline.ruler.before("link", "wikilink", rule);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
