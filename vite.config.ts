import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, "src/client"),
  publicDir: resolve(__dirname, "assets"),
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Regex form so we only proxy /api/* and /__print/*, not /api.ts
      // (which is a relative TS source import).
      "^/api/": "http://localhost:5174",
      "^/__print/": "http://localhost:5174",
      "^/__vendor/": "http://localhost:5174",
      "^/themes/": "http://localhost:5174",
    },
  },
  optimizeDeps: {
    include: [
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/lang-markdown",
      "@codemirror/lang-yaml",
      "codemirror",
      "morphdom",
      "mermaid",
    ],
  },
  build: {
    outDir: resolve(__dirname, "dist-client"),
    emptyOutDir: true,
  },
});
