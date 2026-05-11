import { createHighlighter, type Highlighter } from "shiki";
import { createPipeline, renderMarkdown } from "../shared/markdown/pipeline.js";
import type { ParsedDocument } from "../shared/markdown/pipeline.js";

let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light"],
      langs: [
        "javascript",
        "typescript",
        "tsx",
        "json",
        "yaml",
        "bash",
        "shell",
        "python",
        "rust",
        "go",
        "html",
        "css",
        "markdown",
        "sql",
        "java",
        "c",
        "cpp",
      ],
    });
  }
  return highlighterPromise;
}

export async function renderToHtml(src: string): Promise<ParsedDocument> {
  const hi = await getHighlighter();
  const supported = new Set(hi.getLoadedLanguages());
  const pipeline = createPipeline({
    highlight: (code, lang) => {
      const l = lang.toLowerCase();
      if (!supported.has(l)) return "";
      return hi.codeToHtml(code, { lang: l, theme: "github-light" });
    },
  });
  return renderMarkdown(src, pipeline);
}

export async function warmHighlighter(): Promise<void> {
  await getHighlighter();
}
