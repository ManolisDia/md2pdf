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
  // Scope to .md-doc so the vars apply in BOTH fast preview and the
  // paginated (pagedjs) preview, where the article ends up nested inside
  // .pagedjs_page wrappers.
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
  // Scope dark mode to the preview area only — the app chrome stays light.
  const host = document.getElementById("preview-host");
  if (host) host.dataset.mode = dark ? "dark" : "light";
}

let paginated = false;
let previewer: import("pagedjs").Previewer | null = null;

export function setPaginated(on: boolean): void {
  paginated = on;
}
export function isPaginated(): boolean {
  return paginated;
}

export async function setPreviewHtml(
  host: HTMLElement,
  bodyHtml: string,
): Promise<void> {
  if (paginated) {
    await renderPaginated(host, bodyHtml);
    return;
  }
  await renderFast(host, bodyHtml);
}

async function renderFast(host: HTMLElement, bodyHtml: string): Promise<void> {
  // If we were just in paginated mode, the host has pagedjs structure —
  // tear it down so morphdom can target a fresh article.
  if (host.querySelector(".pagedjs_pages")) {
    host.innerHTML = `<article id="preview" class="md-doc"></article>`;
  }
  // host should be the article; if it's a wrapper, find the article.
  const target =
    host.id === "preview" ? host : (host.querySelector("#preview") as HTMLElement | null);
  if (!target) {
    host.innerHTML = `<article id="preview" class="md-doc">${bodyHtml}</article>`;
    await runMermaidIn(host);
    return;
  }
  const fresh = document.createElement("article");
  fresh.id = "preview";
  fresh.className = "md-doc";
  fresh.innerHTML = bodyHtml;
  morphdom(target, fresh, {
    onBeforeElUpdated: (fromEl, toEl) => !fromEl.isEqualNode(toEl),
  });
  await runMermaidIn(target);
}

async function renderPaginated(
  host: HTMLElement,
  bodyHtml: string,
): Promise<void> {
  // Lazy load pagedjs on first use.
  if (!previewer) {
    const mod = await import("pagedjs");
    previewer = new mod.Previewer();
  }
  // Reset host completely — pagedjs re-builds the page DOM each run.
  host.innerHTML = "";
  // Build a wrapper article that pagedjs will fragment into pages.
  const wrapper = `<article class="md-doc">${bodyHtml}</article>`;
  try {
    await previewer.preview(wrapper, [], host);
  } catch (err) {
    console.error("pagedjs preview failed", err);
    host.innerHTML = `<article class="md-doc">${bodyHtml}</article>`;
  }
  // Run mermaid inside the paginated output. Mermaid blocks that span
  // pages will look odd; users can insert manual page breaks to avoid it.
  await runMermaidIn(host);
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
