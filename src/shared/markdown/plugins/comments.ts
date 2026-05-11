import type MarkdownIt from "markdown-it";
import type { RuleInline } from "markdown-it/lib/parser_inline.mjs";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";

const INLINE_RE = /^%%([\s\S]*?)%%/;

export function obsidianComments(md: MarkdownIt): void {
  const inlineRule: RuleInline = (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x25 /* % */) return false;
    if (state.src.charCodeAt(state.pos + 1) !== 0x25) return false;
    const m = INLINE_RE.exec(state.src.slice(state.pos));
    if (!m) return false;
    if (!silent) {
      // Strip — render nothing
    }
    state.pos += m[0].length;
    return true;
  };
  md.inline.ruler.before("emphasis", "obsidian_comment_inline", inlineRule);

  const blockRule: RuleBlock = (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (max - pos < 2) return false;
    if (state.src.charCodeAt(pos) !== 0x25 || state.src.charCodeAt(pos + 1) !== 0x25) return false;

    // Find closing %%
    let nextLine = startLine;
    let foundClose = false;
    // Check if same line closes
    const firstLineText = state.src.slice(pos + 2, max);
    if (firstLineText.includes("%%")) {
      foundClose = true;
      nextLine = startLine + 1;
    } else {
      nextLine++;
      while (nextLine < endLine) {
        const lpos = state.bMarks[nextLine] + state.tShift[nextLine];
        const lmax = state.eMarks[nextLine];
        if (state.src.slice(lpos, lmax).includes("%%")) {
          foundClose = true;
          nextLine++;
          break;
        }
        nextLine++;
      }
    }
    if (!foundClose) return false;
    if (silent) return true;
    state.line = nextLine;
    return true;
  };
  md.block.ruler.before("paragraph", "obsidian_comment_block", blockRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}
