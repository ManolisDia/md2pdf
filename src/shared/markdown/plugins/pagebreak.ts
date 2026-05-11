import type MarkdownIt from "markdown-it";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";

/**
 * Recognizes `\pagebreak` or `\newpage` on its own line as a forced page
 * break. Renders as a `<div class="page-break"></div>` which the print
 * stylesheet maps to `break-before: page`.
 */
const PAGEBREAK_RE = /^\\(pagebreak|newpage)\s*$/;

export function pageBreaks(md: MarkdownIt): void {
  const rule: RuleBlock = (state, startLine, _endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max);
    if (!PAGEBREAK_RE.test(line)) return false;
    if (silent) return true;

    const token = state.push("page_break", "div", 0);
    token.block = true;
    token.markup = line;
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  };

  md.block.ruler.before("paragraph", "page_break", rule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.renderer.rules.page_break = () =>
    `<div class="page-break" aria-hidden="true"></div>\n`;
}
