export interface RenderResult {
  html: string;
  frontmatter: Record<string, unknown>;
  cssVars: string;
  theme: string;
}

export async function apiRender(
  markdown: string,
  yaml: string,
): Promise<RenderResult> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown, yaml }),
  });
  if (!res.ok) throw new Error(`render failed: ${res.status}`);
  return (await res.json()) as RenderResult;
}

export async function apiPdf(markdown: string, yaml: string): Promise<Blob> {
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown, yaml }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`pdf failed: ${res.status} ${txt}`);
  }
  return await res.blob();
}

export async function apiLoadConfig(): Promise<string> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error(`config failed: ${res.status}`);
  return await res.text();
}

export async function apiSaveConfig(yaml: string): Promise<void> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t);
  }
}
