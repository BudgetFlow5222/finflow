// FinFlow Electron main process.
//
// Dev mode:  `npm run electron:dev`  →  spawns `next dev` on :3000 and loads it.
// Prod mode: packaged app            →  spawns the standalone Next.js server
//                                       (bundled in resources/app/.next/standalone)
//                                       on a local port and loads it in a window.
//
// The SQLite database lives in the OS user-data directory (writable, persists
// across app updates). On first launch we create the schema via prisma db push.

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, execFileSync } = require("node:child_process");

const isDev = !app.isPackaged;
let mainWindow = null;
let serverProc = null;

// Port for the bundled Next.js standalone server in production.
const PROD_PORT = 3310;

// ---------------------------------------------------------------------------
// Database bootstrap
// ---------------------------------------------------------------------------

function getDbPath() {
  const userData = app.getPath("userData");
  return path.join(userData, "finflow.db");
}

function getSchemaPath() {
  if (isDev) {
    return path.join(__dirname, "..", "prisma", "schema.prisma");
  }
  // Packaged: prisma folder is copied into resources/prisma by electron-builder.
  return path.join(process.resourcesPath, "prisma", "schema.prisma");
}

function getPrismaCliPath() {
  // In a packaged app node_modules/prisma is preserved as a prod dependency.
  // Use the absolute path to the CLI entry so it runs under the bundled node.
  return path.join(app.getAppPath(), "node_modules", "prisma", "build", "index.js");
}

function ensureDatabase() {
  const dbPath = getDbPath();
  const schemaPath = getSchemaPath();
  // Always expose the absolute DB path to the Next.js server.
  process.env.FINFLOW_DB_PATH = dbPath;

  if (fs.existsSync(dbPath)) return; // already initialised

  console.log("[finflow] First run — creating database schema…");
  try {
    execFileSync(process.execPath, ["--max-old-space-size=4096", getPrismaCliPath(), "db", "push", `--schema=${schemaPath}`], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    });
    console.log("[finflow] Database ready.");
  } catch (e) {
    console.error("[finflow] Failed to initialise database:", e);
    // Non-fatal — the app will still launch, DB calls will fail and surface
    // their own errors in the UI.
  }
}

// ---------------------------------------------------------------------------
// Next.js server lifecycle
// ---------------------------------------------------------------------------

function startDevServer() {
  // In dev we let `concurrently` start `next dev` separately so we get nice
  // logs in the terminal. Here we just wait for port 3000.
  return new Promise((resolve) => {
    const wait = spawn("npx", ["wait-on", "http://localhost:3000"], {
      stdio: "inherit",
      shell: true,
    });
    wait.on("exit", () => resolve("http://localhost:3000"));
  });
}

function startProdServer() {
  // The standalone build is copied to resources/app/.next/standalone by the
  // electron-builder "files" config. It ships its own server.js.
  const standaloneDir = isDev
    ? path.join(__dirname, "..", ".next", "standalone")
    : path.join(app.getAppPath(), ".next", "standalone");
  const serverJs = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverJs)) {
    console.error("[finflow] Standalone server not found:", serverJs);
    return Promise.reject(new Error("server.js missing — run the build first."));
  }

  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, [serverJs], {
      cwd: standaloneDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(PROD_PORT),
        HOSTNAME: "127.0.0.1",
        // Keep the absolute DB path the server should use.
        FINFLOW_DB_PATH: process.env.FINFLOW_DB_PATH,
      },
    });

    serverProc.stdout.on("data", (d) => process.stdout.write(d));
    serverProc.stderr.on("data", (d) => process.stderr.write(d));

    serverProc.on("error", reject);

    // Wait until the server responds before loading the window.
    const tryLoad = () => {
      const http = require("node:http");
      const req = http.get(`http://127.0.0.1:${PROD_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve(`http://127.0.0.1:${PROD_PORT}`);
        else setTimeout(tryLoad, 300);
        res.resume();
      });
      req.on("error", () => setTimeout(tryLoad, 300));
      req.setTimeout(1500, () => {
        req.destroy();
        setTimeout(tryLoad, 300);
      });
    };
    tryLoad();
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#0b0f0e",
    title: "FinFlow",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(url);

  // Open external links in the user's default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) {
      shell.openExternal(target);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

async function bootstrap() {
  // Only one instance allowed.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Make the DB writable path available before anything reads it.
  ensureDatabase();

  // Build a minimal application menu (File → Quit, View → Reload, etc).
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [{ role: "quit", label: "Quit FinFlow" }],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "About FinFlow",
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send("show-about");
              }
            },
          },
        ],
      },
    ]),
  );

  try {
    const url = isDev ? await startDevServer() : await startProdServer();
    createWindow(url);
  } catch (e) {
    console.error("[finflow] Bootstrap failed:", e);
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  // Desktop convention: quit when all windows closed (even on macOS for this app).
  if (serverProc) {
    try { serverProc.kill(); } catch {}
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProc) {
    try { serverProc.kill("SIGTERM"); } catch {}
    serverProc = null;
  }
});
