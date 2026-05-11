import type { EditorView } from "@codemirror/view";
import { createEditor, insertBlockAtCursor, setEditorValue } from "./editor.js";
import { mountSidebar } from "./sidebar.js";
import {
  applyCssVars,
  applyDarkMode,
  applyPageCss,
  applyTheme,
  isPaginated,
  setPaginated,
  setPreviewHtml,
} from "./preview.js";
import { apiLoadConfig, apiPdf, apiRender, apiSaveConfig } from "./api.js";

const SAMPLE_MARKDOWN = `---
title: Welcome to md2pdf
author: You
date: 2026-05-11
---

# Welcome to md2pdf

Edit this Markdown on the left. The preview updates live. Click **Download PDF** to export.

## Features

- Tables, task lists, footnotes, anchors[^1]
- Math: $E = mc^2$ and block math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

- Highlights: ==important== text
- Sub: H~2~O — Sup: x^2^

> [!tip] Try it
> Edit the YAML on the right to change fonts, colors, and spacing.

> [!warning] Reminder
> Switch themes from the dropdown above.

## Wikilinks & comments

A wikilink: [[Some Note]]. A pipe-aliased: [[Some Note|aliased label]].

%% This comment is stripped from output. %%

## Code

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Mermaid flowchart

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B(md2pdf)
  B --> C{Theme?}
  C -->|academic| D[Serif PDF]
  C -->|technical| E[Mono PDF]
\`\`\`

## Mermaid gantt

\`\`\`mermaid
gantt
  title md2pdf release plan
  dateFormat YYYY-MM-DD
  section Core
  Markdown pipeline      :done,    p1, 2026-05-01, 2d
  Theme system           :done,    p2, after p1, 2d
  PDF + Puppeteer        :active,  p3, after p2, 3d
  section Polish
  UI                     :         p4, after p3, 2d
  Docs                   :         p5, after p4, 1d
\`\`\`

## Tasks

- [x] Render Markdown
- [x] Theme switcher
- [ ] Profit

[^1]: Footnotes work too.
`;

const editorHost = document.getElementById("editor")!;
const previewHostOuter = document.getElementById("preview-host")!;
const previewHost = document.getElementById("preview")!;
const configHost = document.getElementById("config-editor")!;
const themeSelect = document.getElementById("theme-select") as HTMLSelectElement;
const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
const loadBtn = document.getElementById("load-btn") as HTMLButtonElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const saveConfigBtn = document.getElementById("save-config") as HTMLButtonElement;
const configStatus = document.getElementById("config-status")!;
const toastEl = document.getElementById("toast")!;
const dropzoneEl = document.getElementById("dropzone")!;
const pagebreakBtn = document.getElementById("pagebreak-btn") as HTMLButtonElement;
const paginateBtn = document.getElementById("paginate-btn") as HTMLButtonElement;
const darkBtn = document.getElementById("dark-btn") as HTMLButtonElement;

let markdownValue = SAMPLE_MARKDOWN;
let yamlValue = "";
let renderTimer: number | undefined;
let configTimer: number | undefined;
let mainEditor: EditorView | null = null;

function toast(msg: string, isError = false): void {
  toastEl.textContent = msg;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

function debounceRender(): void {
  if (renderTimer) window.clearTimeout(renderTimer);
  // Paginated mode runs Paged.js which is much slower — debounce more.
  const delay = isPaginated() ? 500 : 150;
  renderTimer = window.setTimeout(doRender, delay);
}

function debounceConfig(): void {
  if (configTimer) window.clearTimeout(configTimer);
  configTimer = window.setTimeout(() => {
    syncThemeSelectFromYaml();
    debounceRender();
  }, 200);
}

async function doRender(): Promise<void> {
  try {
    const result = await apiRender(markdownValue, yamlValue);
    applyTheme(result.theme);
    applyCssVars(result.cssVars);
    const { size, margin } = parsePageFromYaml(yamlValue);
    applyPageCss(size, margin);
    applyDarkMode(parseDarkFromYaml(yamlValue));
    // In paginated mode pagedjs rebuilds the host. Pass the outer host so
    // the rebuild can happen.
    const host = isPaginated() ? previewHostOuter : previewHost;
    await setPreviewHtml(host, result.html);
  } catch (err) {
    toast((err as Error).message, true);
  }
}

function parsePageFromYaml(yaml: string): { size: string; margin: string } {
  const sizeM = /^[ \t]*size:\s*([^\s#]+)/m.exec(yaml);
  const marginM = /^[ \t]*margin:\s*([^\s#]+)/m.exec(yaml);
  return {
    size: sizeM?.[1] ?? "A4",
    margin: marginM?.[1] ?? "2cm",
  };
}

function parseDarkFromYaml(yaml: string): boolean {
  return /^dark:\s*true\b/m.test(yaml);
}

function setYamlDark(yaml: string, dark: boolean): string {
  if (/^dark:\s*(true|false)\b/m.test(yaml)) {
    return yaml.replace(/^dark:\s*(true|false)\b/m, `dark: ${dark}`);
  }
  return `${yaml.trimEnd()}\ndark: ${dark}\n`;
}

function syncThemeSelectFromYaml(): void {
  const m = /^theme:\s*(\w+)/m.exec(yamlValue);
  if (m && Array.from(themeSelect.options).some((o) => o.value === m[1])) {
    themeSelect.value = m[1];
  }
}

function setYamlTheme(yaml: string, theme: string): string {
  if (/^theme:\s*\w+/m.test(yaml)) {
    return yaml.replace(/^theme:\s*\w+/m, `theme: ${theme}`);
  }
  return `theme: ${theme}\n${yaml}`;
}

function inferFilename(md: string): string {
  const m = /^title:\s*["']?([^"'\n]+)["']?/m.exec(md);
  const base = (m?.[1] ?? "document").trim();
  return base.replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 80) || "document";
}

function setupDropzone(): void {
  let counter = 0;
  window.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    counter++;
    dropzoneEl.classList.add("active");
  });
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  window.addEventListener("dragleave", () => {
    counter--;
    if (counter <= 0) {
      counter = 0;
      dropzoneEl.classList.remove("active");
    }
  });
  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    counter = 0;
    dropzoneEl.classList.remove("active");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!/\.(md|markdown)$/i.test(file.name) && !file.type.includes("markdown")) {
      toast("Drop a .md file", true);
      return;
    }
    const text = await file.text();
    markdownValue = text;
    if (mainEditor) setEditorValue(mainEditor, text);
    debounceRender();
  });
}

(async () => {
  yamlValue = await apiLoadConfig().catch(() => "");

  mainEditor = createEditor({
    parent: editorHost,
    initial: markdownValue,
    language: "markdown",
    onChange: (v) => {
      markdownValue = v;
      debounceRender();
    },
  });

  const sidebar = mountSidebar(configHost, yamlValue, (v) => {
    yamlValue = v;
    debounceConfig();
  });
  syncThemeSelectFromYaml();

  themeSelect.addEventListener("change", () => {
    yamlValue = setYamlTheme(yamlValue, themeSelect.value);
    sidebar.configEditor.dispatch({
      changes: {
        from: 0,
        to: sidebar.configEditor.state.doc.length,
        insert: yamlValue,
      },
    });
    debounceRender();
  });

  pagebreakBtn.addEventListener("click", () => {
    if (!mainEditor) return;
    insertBlockAtCursor(mainEditor, "\\pagebreak");
  });

  // Initialize Pages button as active (paginated is on by default).
  paginateBtn.classList.toggle("is-active", isPaginated());
  paginateBtn.addEventListener("click", () => {
    const on = !isPaginated();
    setPaginated(on);
    paginateBtn.classList.toggle("is-active", on);
    debounceRender();
  });

  darkBtn.addEventListener("click", () => {
    const next = !parseDarkFromYaml(yamlValue);
    yamlValue = setYamlDark(yamlValue, next);
    sidebar.configEditor.dispatch({
      changes: {
        from: 0,
        to: sidebar.configEditor.state.doc.length,
        insert: yamlValue,
      },
    });
    darkBtn.classList.toggle("is-active", next);
    applyDarkMode(next);
    debounceRender();
  });
  // Initial dark state
  darkBtn.classList.toggle("is-active", parseDarkFromYaml(yamlValue));

  loadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    markdownValue = text;
    if (mainEditor) setEditorValue(mainEditor, text);
    debounceRender();
  });

  downloadBtn.addEventListener("click", async () => {
    downloadBtn.disabled = true;
    const orig = downloadBtn.textContent;
    downloadBtn.textContent = "Generating…";
    try {
      const blob = await apiPdf(markdownValue, yamlValue);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = inferFilename(markdownValue) + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("PDF downloaded");
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = orig;
    }
  });

  saveConfigBtn.addEventListener("click", async () => {
    try {
      await apiSaveConfig(yamlValue);
      configStatus.textContent = "Saved";
      configStatus.classList.remove("error");
      setTimeout(() => (configStatus.textContent = ""), 1800);
    } catch (e) {
      configStatus.textContent = (e as Error).message;
      configStatus.classList.add("error");
    }
  });

  setupDropzone();
  await doRender();
})().catch((err) => {
  console.error(err);
  toast("Init failed: " + (err as Error).message, true);
});
