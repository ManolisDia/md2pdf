# md2pdf

A local web app that converts Markdown to PDF with comprehensive but easy-to-use styling. Drag-drop a `.md`, get live preview, switch themes, tweak fonts/colors/spacing in a YAML sidebar, download a beautifully laid-out PDF. Runs entirely offline.

Supports Obsidian-flavored Markdown: **Mermaid (incl. Gantt)**, math (KaTeX), Obsidian callouts (`> [!note]`), wikilinks (`[[link]]`), comments (`%%...%%`), highlights (`==text==`), footnotes, task lists, frontmatter, and Shiki-highlighted code blocks.

## Quick start

```bash
git clone https://github.com/ManolisDia/md2pdf
cd md2pdf
npm install
npm start
```

The browser opens to `http://localhost:5173`. The first PDF render warms up Puppeteer — give it a couple of seconds.

### Requirements

- Node.js 20+
- One of: Google Chrome, Microsoft Edge, or Chromium installed locally (md2pdf reuses your system browser, so no 170MB Puppeteer download). md2pdf auto-detects standard install paths; you can override with `PUPPETEER_EXECUTABLE_PATH=/path/to/chrome`.

## What's in the box

### Markdown features
- CommonMark + GFM (tables, strikethrough, autolinks)
- Task lists, footnotes, header anchors
- YAML frontmatter (`title`, `author`, `date` → PDF header)
- Math via KaTeX: `$inline$` and `$$display$$`
- Highlights `==text==`, subscript `~x~`, superscript `^x^`
- Obsidian callouts: `> [!note]`, `> [!tip]`, `> [!warning]`, `> [!danger]`, `> [!quote]`, `> [!info]`, `> [!success]`, `> [!example]`, `> [!question]`, `> [!abstract]`, `> [!bug]`
- Wikilinks `[[Target]]` and aliased `[[Target|label]]`
- Comments `%%...%%` (stripped from output)
- Code blocks with Shiki syntax highlighting
- Mermaid diagrams (flowchart, sequence, gantt, pie, class, state, ER, journey, etc.)

### Themes
Five bundled themes — switch live from the dropdown:
- **academic** — serif, justified, classic paper look
- **minimal** — clean sans-serif, lots of whitespace
- **technical** — mono headings, engineering-docs vibe
- **elegant** — book-like, small caps, serif
- **github** — looks like a rendered README on github.com

### Styling
Open the **Style** sidebar to edit `style.yaml` live. Change fonts, colors, spacing, page size, margins; the preview updates within ~200ms.

```yaml
theme: academic
page:
  size: A4
  margin: 2cm
fonts:
  body: "Source Serif"
  headings: "Inter"
  mono: "JetBrains Mono"
  base_size: 11pt
colors:
  text: "#1a1a1a"
  headings: "#0d2538"
  link: "#1f6feb"
  accent: "#d97706"
  code_bg: "#f4f4f5"
  rule: "#e4e4e7"
spacing:
  line_height: 1.6
  paragraph: 0.6em
  heading_top: 1.4em
  max_width: 720px
custom_css: null   # optional: path to your own .css for full control
```

## Architecture

- **Server (Express + TypeScript)** — `/api/render` returns HTML + theme CSS vars; `/api/pdf` returns a PDF.
- **Markdown pipeline** (`src/shared/markdown/pipeline.ts`) — `markdown-it` + plugins + custom Obsidian-syntax plugins.
- **PDF rendering** — `puppeteer-core` with system Chrome/Edge auto-detection; the print template runs Mermaid inside the page so diagrams render against the same fonts and CSS.
- **Frontend** — plain TypeScript, CodeMirror 6 editor, `morphdom` for smooth live-preview updates.

## Scripts

- `npm start` — concurrent dev server (Vite + Express)
- `npm run typecheck` — TypeScript check, no emit
- `npm run build` — build client and server
- `npm run serve` — serve built bundle from `dist-server/`

## License

MIT. See [LICENSE](./LICENSE).
