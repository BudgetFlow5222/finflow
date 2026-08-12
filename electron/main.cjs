const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const isDev = !app.isPackaged;
let mainWindow = null;
let serverProc = null;
const PROD_PORT = 3310;

function getDbPath() { return path.join(app.getPath("userData"), "finflow.db"); }

function getSeedDbPath() {
  if (isDev) return path.join(__dirname, "..", "prisma", "seed.db");
  return path.join(process.resourcesPath, "prisma", "seed.db");
}

function ensureDatabase() {
  const dbPath = getDbPath();
  process.env.FINFLOW_DB_PATH = dbPath;
  if (fs.existsSync(dbPath)) return;
  console.log("[finflow] First run - copying seed database...");
  try {
    const seedPath = getSeedDbPath();
    if (!fs.existsSync(seedPath)) { console.error("[finflow] Seed DB not found:", seedPath); return; }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.copyFileSync(seedPath, dbPath);
    console.log("[finflow] Database ready (" + fs.statSync(dbPath).size + " bytes).");
  } catch (e) { console.error("[finflow] Failed to copy seed DB:", e.message); }
}

function startDevServer() {
  return new Promise((resolve) => {
    const wait = spawn("npx", ["wait-on", "http://localhost:3000"], { stdio: "inherit", shell: true });
    wait.on("exit", () => resolve("http://localhost:3000"));
  });
}

function startProdServer() {
  const standaloneDir = isDev
    ? path.join(__dirname, "..", ".next", "standalone")
    : path.join(process.resourcesPath, "standalone");
  const serverJs = path.join(standaloneDir, "server.js");
  if (!fs.existsSync(serverJs)) {
    console.error("[finflow] Server not found:", serverJs);
    return Promise.reject(new Error("server.js missing"));
  }
  console.log("[finflow] Starting Next.js server from:", standaloneDir);
  return new Promise((resolve, reject) => {
    // CRITICAL: process.execPath is FinFlow.exe (Electron), NOT node.exe.
    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as pure Node.js.
    serverProc = spawn(process.execPath, [serverJs], {
      cwd: standaloneDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(PROD_PORT),
        HOSTNAME: "127.0.0.1",
        FINFLOW_DB_PATH: process.env.FINFLOW_DB_PATH,
      },
    });
    serverProc.stdout.on("data", (d) => process.stdout.write("[server] " + d));
    serverProc.stderr.on("data", (d) => process.stderr.write("[server] " + d));
    serverProc.on("error", reject);
    const tryLoad = () => {
      const http = require("node:http");
      const req = http.get("http://127.0.0.1:" + PROD_PORT + "/", (res) => {
        if (res.statusCode === 200) resolve("http://127.0.0.1:" + PROD_PORT);
        else setTimeout(tryLoad, 300);
        res.resume();
      });
      req.on("error", () => setTimeout(tryLoad, 300));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(tryLoad, 300); });
    };
    tryLoad();
  });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    show: false, backgroundColor: "#0b0f0e", title: "FinFlow",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(url);
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) { shell.openExternal(target); return { action: "deny" }; }
    return { action: "allow" };
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

async function bootstrap() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  ensureDatabase();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "File", submenu: [{ role: "quit", label: "Quit FinFlow" }] },
    { label: "View", submenu: [
      { role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" },
      { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
      { type: "separator" }, { role: "togglefullscreen" },
    ]},
    { label: "Help", submenu: [{ label: "About FinFlow", click: () => { if (mainWindow) mainWindow.webContents.send("show-about"); } }] },
  ]));
  try {
    const url = isDev ? await startDevServer() : await startProdServer();
    createWindow(url);
  } catch (e) { console.error("[finflow] Bootstrap failed:", e.message); app.quit(); }
}

app.whenReady().then(bootstrap);
app.on("window-all-closed", () => { if (serverProc) { try { serverProc.kill(); } catch {} } app.quit(); });
app.on("before-quit", () => { if (serverProc) { try { serverProc.kill("SIGTERM"); } catch {} serverProc = null; } });