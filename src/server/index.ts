import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import YAML from "yaml";

import { renderToHtml, warmHighlighter } from "./render.js";
import { renderPdf, closeBrowser, takePrintJobHtml } from "./pdf.js";
import { loadDefaultConfig, parseStyleConfig, configToCssVars } from "./theme.js";
import type { StyleConfig } from "../shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..", "..");
const PORT = Number(process.env.PORT ?? 5174);
const CLIENT_PORT = Number(process.env.CLIENT_PORT ?? 5173);
const PROD = process.env.NODE_ENV === "production";

const app = express();
app.use(express.json({ limit: "5mb" }));

// Serve themes and assets as static so the client can pull them.
app.use("/themes", express.static(resolve(ROOT_DIR, "themes")));
app.use("/assets", express.static(resolve(ROOT_DIR, "assets")));
// Vendor: mermaid, katex — served so Puppeteer can fetch them via HTTP.
app.use(
  "/__vendor/mermaid",
  express.static(resolve(ROOT_DIR, "node_modules", "mermaid", "dist")),
);
app.use(
  "/__vendor/katex",
  express.static(resolve(ROOT_DIR, "node_modules", "katex", "dist")),
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Internal: Puppeteer fetches the prepared print HTML from here so it
// gets a normal HTTP origin (mermaid ESM imports + KaTeX font fetches
// then work). Tokens are single-use.
app.get("/__print/:id", (req, res) => {
  const html = takePrintJobHtml(req.params.id);
  if (!html) {
    res.status(404).send("not found");
    return;
  }
  res.type("html").send(html);
});

app.get("/api/themes", (_req, res) => {
  res.json({
    themes: [
      "academic",
      "minimal",
      "technical",
      "elegant",
      "github",
      "newspaper",
      "terminal",
      "pastel",
      "whitepaper",
      "magazine",
    ],
  });
});

app.get("/api/config", async (_req, res) => {
  try {
    const yamlSrc = await readFile(
      resolve(ROOT_DIR, "config", "default.style.yaml"),
      "utf8",
    );
    res.type("text/yaml").send(yamlSrc);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post("/api/config", async (req, res) => {
  const yamlSrc = (req.body as { yaml?: string }).yaml ?? "";
  try {
    parseStyleConfig(yamlSrc); // validate
    await writeFile(
      resolve(ROOT_DIR, "config", "default.style.yaml"),
      yamlSrc,
      "utf8",
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post("/api/render", async (req, res) => {
  try {
    const { markdown = "", yaml = "" } = req.body as {
      markdown?: string;
      yaml?: string;
    };
    const cfg = yaml ? parseStyleConfig(yaml) : await loadDefaultConfig(ROOT_DIR);
    const { html, frontmatter } = await renderToHtml(markdown);
    res.json({
      html,
      frontmatter,
      cssVars: configToCssVars(cfg),
      theme: cfg.theme,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post("/api/pdf", async (req, res) => {
  try {
    const { markdown = "", yaml = "" } = req.body as {
      markdown?: string;
      yaml?: string;
    };
    const cfg: StyleConfig = yaml
      ? parseStyleConfig(yaml)
      : await loadDefaultConfig(ROOT_DIR);
    const { html, frontmatter } = await renderToHtml(markdown);
    const pdf = await renderPdf({
      rootDir: ROOT_DIR,
      config: cfg,
      bodyHtml: html,
      frontmatter,
    });
    const filename = sanitizeFilename(
      (frontmatter.title as string) || "document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.pdf"`,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 80) || "document";
}

// In production, serve the built client too.
if (PROD) {
  app.use(express.static(resolve(ROOT_DIR, "dist-client")));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(ROOT_DIR, "dist-client", "index.html"));
  });
}

const server = app.listen(PORT, () => {
  const browserUrl = PROD
    ? `http://localhost:${PORT}`
    : `http://localhost:${CLIENT_PORT}`;
  console.log(`[md2pdf] api on http://localhost:${PORT}`);
  console.log(`[md2pdf] open ${browserUrl}`);

  // Warm Shiki in the background so the first render is snappy.
  warmHighlighter().catch(() => {});

  // Auto-open the browser on first start. In dev, Vite is serving the client.
  if (!process.env.MD2PDF_NO_OPEN) {
    open(browserUrl).catch(() => {});
  }
});

function shutdown(): void {
  console.log("[md2pdf] shutting down…");
  closeBrowser().finally(() => server.close(() => process.exit(0)));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
