import MarkdownIt from "markdown-it";
import matter from "gray-matter";
// @ts-expect-error - no types
import footnote from "markdown-it-footnote";
// @ts-expect-error - no types
import taskLists from "markdown-it-task-lists";
// @ts-expect-error - no types
import mark from "markdown-it-mark";
// @ts-expect-error - no types
import sub from "markdown-it-sub";
// @ts-expect-error - no types
import sup from "markdown-it-sup";
import anchor from "markdown-it-anchor";
// @ts-expect-error - no types
import katex from "markdown-it-katex";

import { obsidianCallouts } from "./plugins/callouts.js";
import { wikilinks } from "./plugins/wikilinks.js";
import { obsidianComments } from "./plugins/comments.js";
import { mermaidBlocks } from "./plugins/mermaid.js";
import { pageBreaks } from "./plugins/pagebreak.js";

export interface PipelineOptions {
  // Optional async syntax highlighter for code blocks (server-side Shiki).
  // Returns ready-formatted HTML for the entire <pre><code>…</code></pre> block.
  highlight?: (code: string, lang: string) => string;
}

export function createPipeline(opts: PipelineOptions = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight: (code, lang) => {
      if (!lang || lang.toLowerCase() === "mermaid") return "";
      if (opts.highlight) {
        try {
          return opts.highlight(code, lang);
        } catch {
          return "";
        }
      }
      return "";
    },
  });

  md.use(footnote);
  md.use(taskLists, { enabled: true, label: true, labelAfter: false });
  md.use(mark);
  md.use(sub);
  md.use(sup);
  md.use(anchor, {
    permalink: anchor.permalink.headerLink({ safariReaderFix: true }),
    slugify: (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-"),
  });
  md.use(katex, { throwOnError: false });
  md.use(obsidianComments);
  md.use(obsidianCallouts);
  md.use(wikilinks);
  md.use(mermaidBlocks);
  md.use(pageBreaks);

  return md;
}

export interface ParsedDocument {
  html: string;
  frontmatter: Record<string, unknown>;
}

export function renderMarkdown(
  src: string,
  pipeline: MarkdownIt,
): ParsedDocument {
  const parsed = matter(src);
  const html = pipeline.render(parsed.content);
  return {
    html,
    frontmatter: parsed.data as Record<string, unknown>,
  };
}
