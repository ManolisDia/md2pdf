import morphdom from "morphdom";
import mermaid from "mermaid";

let mermaidInitialized = false;

function ensureMermaid(): void {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    gantt: { useWidth: 800 },
  });
  mermaidInitialized = true;
}

let activeTheme = "academic";
let userVarStyleEl: HTMLStyleElement | null = null;
let pageStyleEl: HTMLStyleElement | null = null;
let themeLinkEl: HTMLLinkElement | null = null;

export function applyTheme(theme: string): void {
  if (theme === activeTheme && themeLinkEl) return;
  activeTheme = theme;
  if (!themeLinkEl) {
    themeLinkEl = document.createElement("link");
    themeLinkEl.rel = "stylesheet";
    document.head.appendChild(themeLinkEl);
  }
  themeLinkEl.href = `/themes/${theme}.css`;
}

export function applyCssVars(cssVarsBlock: string): void {
  if (!userVarStyleEl) {
    userVarStyleEl = document.createElement("style");
    userVarStyleEl.dataset.role = "user-vars";
    document.head.appendChild(userVarStyleEl);
  }
  // Scope to .md-doc so vars apply to the rendered document only.
  const scoped = cssVarsBlock.replace(":root", ".md-doc");
  userVarStyleEl.textContent = scoped;
}

export function applyPageCss(size: string, margin: string): void {
  if (!pageStyleEl) {
    pageStyleEl = document.createElement("style");
    pageStyleEl.dataset.role = "page-css";
    document.head.appendChild(pageStyleEl);
  }
  pageStyleEl.textContent = `@page { size: ${size}; margin: ${margin}; }`;
}

export function applyDarkMode(dark: boolean): void {
  const host = document.getElementById("preview-host");
  if (host) host.dataset.mode = dark ? "dark" : "light";
}

const PAGE_SIZE_MM: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}

function parseCssLengthToPx(s: string): number {
  const m = /^([\d.]+)\s*(mm|cm|in|pt|px)?$/i.exec(s.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] ?? "px").toLowerCase();
  const factors: Record<string, number> = {
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    in: 96,
    pt: 96 / 72,
    px: 1,
  };
  return n * (factors[u] ?? 1);
}

export interface PageDims {
  size: string;
  margin: string;
}

export interface ComputedDims {
  widthPx: number;
  heightPx: number;
  marginPx: number;
  contentHPx: number;
}

export function computePageDims(dims: PageDims): ComputedDims {
  const mm = PAGE_SIZE_MM[dims.size] ?? PAGE_SIZE_MM.A4;
  const widthPx = mmToPx(mm.width);
  const heightPx = mmToPx(mm.height);
  const marginPx = parseCssLengthToPx(dims.margin);
  return {
    widthPx,
    heightPx,
    marginPx,
    contentHPx: heightPx - 2 * marginPx,
  };
}

export async function setPreviewHtml(
  hostOuter: HTMLElement,
  bodyHtml: string,
  dims: PageDims,
): Promise<void> {
  const computed = computePageDims(dims);
  // Page-shaped sheet, sized to the PDF page dimensions. The .md-doc
  // inside fills the page content area (no extra padding) so layout in
  // preview ≈ layout in PDF. Background colour comes from the theme's
  // --md-color-bg, so dark mode has a dark sheet (no white border).
  let sheet = hostOuter.querySelector<HTMLElement>(".preview-sheet");
  if (!sheet) {
    hostOuter.innerHTML = `<div class="preview-sheet"><article id="preview" class="md-doc"></article></div>`;
    sheet = hostOuter.querySelector<HTMLElement>(".preview-sheet")!;
  }
  sheet.style.setProperty("--sheet-width", `${computed.widthPx}px`);
  sheet.style.setProperty("--sheet-padding", `${computed.marginPx}px`);
  sheet.style.setProperty("--sheet-page-h", `${computed.contentHPx}px`);

  const target = sheet.querySelector<HTMLElement>("#preview")!;
  const fresh = document.createElement("article");
  fresh.id = "preview";
  fresh.className = "md-doc";
  fresh.innerHTML = bodyHtml;
  morphdom(target, fresh, {
    onBeforeElUpdated: (fromEl, toEl) => !fromEl.isEqualNode(toEl),
  });

  await runMermaidIn(target);
  // Mirror .md-doc's computed background onto the sheet so the padding
  // area (the simulated page margin) matches the doc colour — no white
  // border in dark mode.
  const bg = getComputedStyle(target).backgroundColor;
  if (bg && bg !== "rgba(0, 0, 0, 0)") sheet.style.backgroundColor = bg;
  // Mermaid changes heights; re-measure breaks after it settles.
  placeNaturalBreaks(sheet, computed);
}

function placeNaturalBreaks(sheet: HTMLElement, dims: ComputedDims): void {
  // Remove old break markers.
  sheet.querySelectorAll(".natural-break").forEach((el) => el.remove());

  const article = sheet.querySelector<HTMLElement>("#preview");
  if (!article) return;
  const innerHeight = article.scrollHeight;
  if (innerHeight <= dims.contentHPx + 4) return; // single page

  const numBreaks = Math.floor((innerHeight - 1) / dims.contentHPx);
  for (let i = 1; i <= numBreaks; i++) {
    const y = dims.marginPx + i * dims.contentHPx;
    const div = document.createElement("div");
    div.className = "natural-break";
    div.style.top = `${y}px`;
    div.dataset.page = String(i + 1);
    sheet.appendChild(div);
  }
}

async function runMermaidIn(root: HTMLElement): Promise<void> {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>("pre.mermaid:not([data-rendered])"),
  );
  if (nodes.length === 0) return;
  ensureMermaid();
  try {
    await mermaid.run({ nodes });
    for (const el of nodes) el.dataset.rendered = "1";
  } catch (err) {
    console.error("mermaid preview render failed", err);
  }
}
