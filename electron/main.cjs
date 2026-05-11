/**
 * Electron main process — starts the bundled Express server in-process
 * via dynamic import, then opens a BrowserWindow pointed at it. The
 * server already serves the built client in production mode.
 */
const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const isDev = !app.isPackaged;
const PORT = Number(process.env.MD2PDF_PORT || 5174);

function getAppRoot() {
  if (isDev) return path.resolve(__dirname, "..");
  // With asar disabled, packaged resources sit at resources/app/.
  return path.join(process.resourcesPath, "app");
}

// Server config (read by src/server/index.ts).
process.env.MD2PDF_NO_OPEN = "1"; // don't try to open a browser
process.env.PORT = String(PORT);
process.env.NODE_ENV = "production";
process.env.MD2PDF_ROOT = getAppRoot();

let serverStarted = false;
let mainWindow = null;

async function startServer() {
  if (serverStarted) return;
  serverStarted = true;
  const serverFile = path.join(
    getAppRoot(),
    "dist-server",
    "server",
    "index.js",
  );
  // The server is ESM; main process is CJS — dynamic import is the bridge.
  await import(pathToFileURL(serverFile).href);
}

async function waitForServer(timeoutMs = 30_000) {
  const start = Date.now();
  const url = `http://localhost:${PORT}/api/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("md2pdf server failed to start within 30s");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "md2pdf",
    autoHideMenuBar: true,
    backgroundColor: "#0e0e10",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Hide the default menu bar.
  Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // External links open in the user's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    await waitForServer();
    createWindow();
  } catch (err) {
    console.error("[md2pdf] startup failed:", err);
    const { dialog } = require("electron");
    dialog.showErrorBox(
      "md2pdf failed to start",
      String(err && err.stack ? err.stack : err),
    );
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverStarted) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
