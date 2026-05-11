import { existsSync } from "node:fs";
import { platform } from "node:os";

/**
 * Returns the first installed Chrome/Edge/Chromium executable path it finds,
 * or null if none is available. We prefer system browsers so users don't pay
 * the 170MB puppeteer Chromium download.
 */
export function detectChrome(): string | null {
  const candidates = getCandidates();
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function getCandidates(): string[] {
  const env = process.env;
  const overrides = [
    env.PUPPETEER_EXECUTABLE_PATH,
    env.CHROME_PATH,
  ].filter((v): v is string => !!v);

  const list = [...overrides];
  const os = platform();
  if (os === "win32") {
    const localAppData = env.LOCALAPPDATA ?? "";
    list.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
      `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe`,
    );
  } else if (os === "darwin") {
    list.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    list.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
      "/snap/bin/chromium",
    );
  }
  return list;
}
