import puppeteer, { type Browser } from "puppeteer-core";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { detectChrome } from "./chrome.js";
import { configToCssVars } from "./theme.js";
import type { StyleConfig } from "../shared/types.js";

const API_PORT = Number(process.env.PORT ?? 5174);
const ASSET_BASE = `http://localhost:${API_PORT}`;

let browserPromise: Promise<Browser> | null = null;

// In-memory stash of pending print jobs (HTML keyed by token). Express
// serves them at /__print/:id so Puppeteer can `page.goto` an HTTP URL
// rather than using setContent (which gives the page an opaque origin
// that blocks ESM imports of mermaid).
const pendingPrintJobs = new Map<string, string>();
export function takePrintJobHtml(id: string): string | undefined {
  const html = pendingPrintJobs.get(id);
  pendingPrintJobs.delete(id);
  return html;
}

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
    page.on("console", (msg) => {
      const t = msg.type();
      if (t === "error" || t === "warn") {
        console.error(`[pdf-page:${t}]`, msg.text());
      }
    });
    page.on("pageerror", (err) => {
      console.error("[pdf-page:error]", err.message);
    });
    page.on("requestfailed", (req) => {
      console.error("[pdf-page:requestfailed]", req.url(), req.failure()?.errorText);
    });

    const html = await buildPrintHtml(opts);
    const jobId = randomUUID();
    pendingPrintJobs.set(jobId, html);
    try {
      await page.goto(`${ASSET_BASE}/__print/${jobId}`, {
        waitUntil: "domcontentloaded",
      });
    } finally {
      pendingPrintJobs.delete(jobId);
    }

    // Wait for fonts and Mermaid/KaTeX rendering signal.
    await page.waitForFunction("window.__renderReady === true", {
      timeout: 30_000,
    });
    await page.evaluateHandle("document.fonts.ready");

    // @page margin is 0 — the user-configured margin lives on body
    // padding so the margin area is painted in the document bg colour.
    // Set Puppeteer's margin to 0 to match.
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      format: opts.config.page.size,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
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

  const pageCss = `@page { size: ${config.page.size}; margin: 0; } :root { --md-pdf-margin: ${config.page.margin}; }`;

  const katexCss = await readFile(
    resolve(rootDir, "node_modules", "katex", "dist", "katex.min.css"),
    "utf8",
  );
  // Rewrite KaTeX font URLs to HTTP URLs served by Express, so Puppeteer can fetch them.
  const katexCssPatched = katexCss.replace(
    /url\((['"]?)fonts\//g,
    `url($1${ASSET_BASE}/__vendor/katex/fonts/`,
  );

  const titleRaw = (frontmatter.title as string) || "Document";
  const title = escapeHtml(titleRaw);
  const meta = renderFrontmatterHeader(frontmatter);

  const mermaidUrl = `${ASSET_BASE}/__vendor/mermaid/mermaid.esm.min.mjs`;

  const dataMode = config.dark ? "dark" : "light";

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
    .replace("{{DATA_MODE}}", dataMode)
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
