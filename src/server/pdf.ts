import puppeteer, { type Browser } from "puppeteer-core";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { detectChrome } from "./chrome.js";
import { configToCssVars } from "./theme.js";
import type { StyleConfig } from "../shared/types.js";

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;
  const executablePath = detectChrome();
  if (!executablePath) {
    throw new Error(
      "No Chrome, Edge, or Chromium found. Install Chrome or Edge, or set PUPPETEER_EXECUTABLE_PATH.",
    );
  }
  browserPromise = puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

interface PdfOptions {
  rootDir: string;
  config: StyleConfig;
  bodyHtml: string;
  frontmatter: Record<string, unknown>;
}

export async function renderPdf(opts: PdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const html = await buildPrintHtml(opts);
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // Wait for fonts and Mermaid/KaTeX rendering signal.
    await page.waitForFunction(
      () => (window as unknown as { __renderReady?: boolean }).__renderReady === true,
      { timeout: 30_000 },
    );
    await page.evaluateHandle("document.fonts.ready");

    const margin = opts.config.page.margin;
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      format: opts.config.page.size,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

async function buildPrintHtml(opts: PdfOptions): Promise<string> {
  const { rootDir, config, bodyHtml, frontmatter } = opts;
  const templatePath = resolve(rootDir, "print", "template.html");
  const tmpl = await readFile(templatePath, "utf8");

  const themeName = config.theme;
  const themeCss = await readFile(
    resolve(rootDir, "themes", `${themeName}.css`),
    "utf8",
  );
  const variablesCss = await readFile(
    resolve(rootDir, "themes", "_variables.css"),
    "utf8",
  );

  // Strip the @import on variables in theme files so we can inline both.
  const themeCssClean = themeCss.replace(/@import\s+url\(["']?\.\/_variables\.css["']?\);?/g, "");
  const userVars = configToCssVars(config);

  let customCss = "";
  if (config.custom_css) {
    try {
      const path = resolve(rootDir, config.custom_css);
      customCss = await readFile(path, "utf8");
    } catch {
      // ignore — leave empty
    }
  }

  const pageCss = `@page { size: ${config.page.size}; margin: ${config.page.margin}; }`;

  const katexCss = await readFile(
    resolve(rootDir, "node_modules", "katex", "dist", "katex.min.css"),
    "utf8",
  );
  const katexDir = pathToFileURL(
    resolve(rootDir, "node_modules", "katex", "dist") + "/",
  ).toString();
  // Rewrite KaTeX font URLs to absolute file:// paths so Puppeteer loads them.
  const katexCssPatched = katexCss.replace(
    /url\((['"]?)fonts\//g,
    `url($1${katexDir}fonts/`,
  );

  const titleRaw = (frontmatter.title as string) || "Document";
  const title = escapeHtml(titleRaw);
  const meta = renderFrontmatterHeader(frontmatter);

  const mermaidPath = resolve(
    rootDir,
    "node_modules",
    "mermaid",
    "dist",
    "mermaid.esm.min.mjs",
  );
  const mermaidUrl = pathToFileURL(mermaidPath).toString();

  return tmpl
    .replace(/\{\{TITLE\}\}/g, title)
    .replace("/*{{PAGE_CSS}}*/", pageCss)
    .replace("/*{{VARIABLES_CSS}}*/", variablesCss)
    .replace("/*{{THEME_CSS}}*/", themeCssClean)
    .replace("/*{{USER_VARS}}*/", userVars)
    .replace("/*{{KATEX_CSS}}*/", katexCssPatched)
    .replace("/*{{CUSTOM_CSS}}*/", customCss)
    .replace("{{MERMAID_URL}}", mermaidUrl)
    .replace("{{FRONTMATTER_HEADER}}", meta)
    .replace("{{BODY}}", bodyHtml);
}

function renderFrontmatterHeader(fm: Record<string, unknown>): string {
  const title = fm.title as string | undefined;
  const author = fm.author as string | undefined;
  const date = fm.date as string | undefined;
  if (!title && !author && !date) return "";
  return `<header class="doc-header">${[
    title ? `<h1 class="doc-title">${escapeHtml(title)}</h1>` : "",
    author ? `<div class="doc-author">${escapeHtml(author)}</div>` : "",
    date ? `<div class="doc-date">${escapeHtml(String(date))}</div>` : "",
  ]
    .filter(Boolean)
    .join("")}</header>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
