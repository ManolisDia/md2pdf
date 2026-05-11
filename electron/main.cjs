/**
 * Electron main process — starts the bundled Express server in-process
 * via dynamic import, then opens a BrowserWindow pointed at it. The
 * server already serves the built client in production mode.
 */
const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("node:path");
const net = require("node:net");
const { pathToFileURL } = require("node:url");

// Single-instance lock: if md2pdf is already running, focus the existing
// window instead of spawning a second process that would fail to bind
// the server port and die silently.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

const isDev = !app.isPackaged;
let PORT = Number(process.env.MD2PDF_PORT || 5174);

function getAppRoot() {
  if (isDev) return path.resolve(__dirname, "..");
  // With asar disabled, packaged resources sit at resources/app/.
  return path.join(process.resourcesPath, "app");
}

// Find a free port if the preferred one is taken, so two installs of
// md2pdf (or a stale process holding 5174) don't break startup.
function findFreePort(preferred) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const srv = net.createServer();
      srv.once("error", () => {
        srv.close();
        if (p - preferred > 20) resolve(0); // give up — let OS choose
        else tryPort(p + 1);
      });
      srv.listen(p, "127.0.0.1", () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
    };
    tryPort(preferred);
  });
}

// Server config (read by src/server/index.ts).
process.env.MD2PDF_NO_OPEN = "1"; // don't try to open a browser
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
    // Pick a free port now; export it so the server picks it up.
    PORT = await findFreePort(PORT);
    if (!PORT) throw new Error("could not find a free port for the server");
    process.env.PORT = String(PORT);

    await startServer();
    await waitForServer();
    createWindow();
  } catch (err) {
    console.error("[md2pdf] startup failed:", err);
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

// If a second instance launches, focus the existing window instead.
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
