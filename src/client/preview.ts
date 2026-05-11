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
  // Scope to #preview so the document area takes the vars without clobbering UI.
  const scoped = cssVarsBlock.replace(":root", "#preview");
  userVarStyleEl.textContent = scoped;
}

export async function setPreviewHtml(
  host: HTMLElement,
  bodyHtml: string,
): Promise<void> {
  const fresh = document.createElement("article");
  fresh.id = "preview";
  fresh.className = "md-doc";
  fresh.innerHTML = bodyHtml;

  morphdom(host, fresh, {
    onBeforeElUpdated: (fromEl, toEl) => {
      // Skip identical nodes for a smoother feel
      return !fromEl.isEqualNode(toEl);
    },
  });

  // Render Mermaid diagrams after morphdom.
  const mermaidEls = Array.from(
    host.querySelectorAll<HTMLElement>("pre.mermaid:not([data-rendered])"),
  );
  if (mermaidEls.length > 0) {
    ensureMermaid();
    try {
      await mermaid.run({ nodes: mermaidEls });
      for (const el of mermaidEls) el.dataset.rendered = "1";
    } catch (err) {
      console.error("mermaid preview render failed", err);
    }
  }
}
