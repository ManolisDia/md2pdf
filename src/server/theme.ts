import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import type { StyleConfig } from "../shared/types.js";

const DEFAULT_CONFIG: StyleConfig = {
  theme: "academic",
  page: { size: "A4", margin: "2cm" },
  fonts: {
    body: "Source Serif",
    headings: "Inter",
    mono: "JetBrains Mono",
    base_size: "11pt",
  },
  colors: {
    text: "#1a1a1a",
    headings: "#0d2538",
    link: "#1f6feb",
    accent: "#d97706",
    code_bg: "#f4f4f5",
    rule: "#e4e4e7",
  },
  spacing: {
    line_height: 1.6,
    paragraph: "0.6em",
    heading_top: "1.4em",
    max_width: "720px",
  },
  custom_css: null,
};

const VALID_THEMES = new Set([
  "academic",
  "minimal",
  "technical",
  "elegant",
  "github",
]);

export function parseStyleConfig(yamlSrc: string): StyleConfig {
  try {
    const raw = (YAML.parse(yamlSrc) ?? {}) as Partial<StyleConfig>;
    return mergeConfig(DEFAULT_CONFIG, raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function loadDefaultConfig(rootDir: string): Promise<StyleConfig> {
  const path = resolve(rootDir, "config", "default.style.yaml");
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const yamlSrc = await readFile(path, "utf8");
  return parseStyleConfig(yamlSrc);
}

export function configToCssVars(cfg: StyleConfig): string {
  const fontFamily = (name: string, fallback: string) => `"${name}", ${fallback}`;
  const vars: Record<string, string> = {
    "--md-font-body": fontFamily(cfg.fonts.body, "Georgia, serif"),
    "--md-font-headings": fontFamily(cfg.fonts.headings, "-apple-system, sans-serif"),
    "--md-font-mono": fontFamily(cfg.fonts.mono, "Consolas, monospace"),
    "--md-font-size": cfg.fonts.base_size,
    "--md-color-text": cfg.colors.text,
    "--md-color-headings": cfg.colors.headings,
    "--md-color-link": cfg.colors.link,
    "--md-color-accent": cfg.colors.accent,
    "--md-color-code-bg": cfg.colors.code_bg,
    "--md-color-rule": cfg.colors.rule,
    "--md-line-height": String(cfg.spacing.line_height),
    "--md-paragraph-spacing": cfg.spacing.paragraph,
    "--md-heading-top": cfg.spacing.heading_top,
    "--md-max-width": cfg.spacing.max_width,
    "--md-page-size": cfg.page.size,
    "--md-page-margin": cfg.page.margin,
  };
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${body}\n}\n`;
}

export function resolveTheme(theme: string): string {
  if (!VALID_THEMES.has(theme)) return "academic";
  return theme;
}

function mergeConfig(
  base: StyleConfig,
  override: Partial<StyleConfig>,
): StyleConfig {
  const out: StyleConfig = {
    theme: resolveTheme(override.theme ?? base.theme) as StyleConfig["theme"],
    page: { ...base.page, ...(override.page ?? {}) },
    fonts: { ...base.fonts, ...(override.fonts ?? {}) },
    colors: { ...base.colors, ...(override.colors ?? {}) },
    spacing: { ...base.spacing, ...(override.spacing ?? {}) },
    custom_css: override.custom_css ?? base.custom_css ?? null,
  };
  return out;
}

export { DEFAULT_CONFIG };
