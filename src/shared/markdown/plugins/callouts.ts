import type MarkdownIt from "markdown-it";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";

const CALLOUT_TYPES: Record<string, { icon: string; label: string }> = {
  note: { icon: "✎", label: "Note" },
  info: { icon: "ℹ", label: "Info" },
  tip: { icon: "★", label: "Tip" },
  success: { icon: "✓", label: "Success" },
  warning: { icon: "⚠", label: "Warning" },
  danger: { icon: "⚡", label: "Danger" },
  error: { icon: "✕", label: "Error" },
  quote: { icon: "❝", label: "Quote" },
  abstract: { icon: "≡", label: "Abstract" },
  question: { icon: "?", label: "Question" },
  example: { icon: "→", label: "Example" },
  bug: { icon: "🐞", label: "Bug" },
};

const CALLOUT_RE = /^\[!([\w-]+)\]([+-]?)\s*(.*)$/;

export function obsidianCallouts(md: MarkdownIt): void {
  const defaultBlockquote = md.renderer.rules.blockquote_open;
  const defaultBlockquoteClose = md.renderer.rules.blockquote_close;

  const calloutRule: RuleBlock = (state, startLine, endLine, silent) => {
    if (silent) return false;
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (state.src.charCodeAt(pos) !== 0x3e /* > */) return false;

    const lineText = state.src.slice(pos + 1, max).replace(/^\s/, "");
    const match = CALLOUT_RE.exec(lineText);
    if (!match) return false;

    return false;
  };

  md.block.ruler.before("blockquote", "obsidian_callout", calloutRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.core.ruler.after("block", "obsidian_callout_transform", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type !== "blockquote_open") continue;
      const inlineTok = findFirstInline(tokens, i);
      if (!inlineTok) continue;
      const text = inlineTok.content;
      const firstLineEnd = text.indexOf("\n");
      const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
      const rest = firstLineEnd === -1 ? "" : text.slice(firstLineEnd + 1);
      const m = CALLOUT_RE.exec(firstLine.trim());
      if (!m) continue;
      const kind = m[1].toLowerCase();
      const title = m[3].trim();
      const info = CALLOUT_TYPES[kind] || { icon: "•", label: kind };
      tok.attrSet("class", `callout callout-${kind}`);
      tok.attrSet("data-callout", kind);
      tok.meta = { callout: { kind, title: title || info.label, icon: info.icon } };
      inlineTok.content = rest;
      inlineTok.children = state.md.parseInline(rest, state.env)[0]?.children ?? [];
    }
  });

  md.renderer.rules.blockquote_open = (tokens, idx, opts, env, self) => {
    const tok = tokens[idx];
    const meta = tok.meta?.callout;
    if (!meta) {
      return defaultBlockquote
        ? defaultBlockquote(tokens, idx, opts, env, self)
        : self.renderToken(tokens, idx, opts);
    }
    return `<div class="callout callout-${meta.kind}" data-callout="${meta.kind}">` +
      `<div class="callout-title"><span class="callout-icon">${meta.icon}</span><span class="callout-label">${escapeHtml(meta.title)}</span></div>` +
      `<div class="callout-body">`;
  };

  md.renderer.rules.blockquote_close = (tokens, idx, opts, env, self) => {
    // Walk back to matching open
    let depth = 1;
    let openIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      const t = tokens[i];
      if (t.type === "blockquote_close") depth++;
      else if (t.type === "blockquote_open") {
        depth--;
        if (depth === 0) {
          openIdx = i;
          break;
        }
      }
    }
    if (openIdx >= 0 && tokens[openIdx].meta?.callout) {
      return `</div></div>`;
    }
    return defaultBlockquoteClose
      ? defaultBlockquoteClose(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };
}

function findFirstInline(tokens: ReturnType<MarkdownIt["parse"]>, openIdx: number) {
  for (let i = openIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === "inline") return tokens[i];
    if (tokens[i].type === "blockquote_close") return null;
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
