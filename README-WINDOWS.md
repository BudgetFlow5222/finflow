# FinFlow — Windows Desktop Application

FinFlow is a financial management app for freelancers, consultants, and small
businesses. It runs as a native desktop application on Windows (and macOS /
Linux) via [Electron](https://www.electronjs.org/), which wraps the Next.js
web stack (React UI + server-side API routes + Prisma/SQLite database) into a
single installable program.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FinFlow.exe (Electron shell)                               │
│                                                             │
│  ┌───────────────────────┐    ┌──────────────────────────┐  │
│  │  Main process (Node)  │───▶│  Next.js standalone      │  │
│  │  electron/main.cjs    │    │  server (port 3310)      │  │
│  │                       │    │  • API routes             │  │
│  │  • Spawns server      │    │  • Prisma → SQLite        │  │
│  │  • Creates window     │    │  • z-ai-web-dev-sdk       │  │
│  │  • DB bootstrap        │    └──────────────────────────┘  │
│  └───────────┬───────────┘                  ▲               │
│              │                              │               │
│  ┌───────────▼──────────────────────────────▼──────────┐    │
│  │  BrowserWindow (Chromium)                            │    │
│  │  loads http://127.0.0.1:3310                        │    │
│  │  • React 19 UI, shadcn/ui, Recharts                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

- **Base currency**: INR (all amounts stored in INR).
- **Display currency**: user-selectable (INR / USD / EUR / GBP) — conversion
  happens at render time.
- **Database**: SQLite file at `%APPDATA%\FinFlow\finflow.db` on Windows.
  Created automatically on first launch.

---

## Prerequisites (build machine)

- **Node.js 20+** and **npm** (or **Bun** — the project uses Bun in dev, but
  the packaging scripts use `npm` for broadest Electron compatibility).
- **Windows 10/11 x64** to build the Windows installer.
  - You can cross-build from macOS/Linux with `--win` but code-signing
    requires a Windows host or a CI runner.
- ~2 GB free disk for the build output + Electron binaries.

Install the project dependencies once:

```bash
npm install
```

> If you use Bun: `bun install` works too, but run the packaging step with
> `npm run dist:win` so electron-builder picks up the right lifecycle hooks.

---

## Development (live reload in an Electron window)

```bash
npm run electron:dev
```

This uses `concurrently` to start the Next.js dev server on port 3000 and
launch Electron pointed at it. Edits to `src/**` hot-reload inside the
Electron window just like the browser.

---

## Build the Windows installer (.exe)

### Step 1 — Compile the Next.js standalone bundle + Prisma client

```bash
npm run electron:build
```

This runs `next build` (producing `.next/standalone/`), copies the static
assets + public folder into the standalone dir, and regenerates the Prisma
client so the right query engine is bundled.

### Step 2 — Package with electron-builder

```bash
npm run dist:win
```

This runs Step 1 automatically, then invokes `electron-builder --win --x64`.
The output is an NSIS installer at:

```
release/FinFlow-Setup-1.0.0.exe
```

Double-click the installer on a Windows machine to install FinFlow into
`%LOCALAPPDATA%\Programs\FinFlow\`, with Start Menu + Desktop shortcuts.

---

## What gets bundled

`electron-builder` packages (per the `build` field in `package.json`):

- `electron/main.cjs` + `electron/preload.cjs` — the desktop shell.
- `.next/standalone/**` — the self-contained Next.js server (its own
  `node_modules` subset, `server.js`, `.next/static`, `public/`).
- `prisma/schema.prisma` (as `extraResources/prisma/`) — used on first launch
  to create the SQLite schema via `prisma db push`.
- `node_modules/prisma/build/**` + `@prisma/client/**` + `@prisma/engines/**`
  — the Prisma CLI and query engine needed at runtime.
- App icons (`electron/build/icon.ico`).

The SQLite database itself is **not** bundled — it is created on first run in
the user's `%APPDATA%\FinFlow\` directory, so it survives app updates and
uninstalls (unless the user explicitly removes app data).

---

## First-run behaviour

When `FinFlow.exe` starts for the first time:

1. The main process checks for `%APPDATA%\FinFlow\finflow.db`.
2. If missing, it runs `prisma db push --schema=…/schema.prisma` against the
   new file — this creates all 16 tables (Accounts, Customers, Vendors, …).
3. It starts the Next.js server on `127.0.0.1:3310`.
4. Once the server responds, it opens the BrowserWindow and loads the app.
5. The user can click **"Load Demo"** on the empty dashboard to seed sample
   data (4 accounts, 5 customers, 12 sales, 20 expenses, 5 invoices, …).

Subsequent launches skip step 2 and load instantly.

---

## Code signing (optional, for distribution)

For public distribution you should code-sign the installer so Windows
SmartScreen doesn't warn users. Obtain an EV or standard code-signing
certificate, then set these environment variables before `npm run dist:win`:

```bash
export CSC_LINK="path/to/cert.pfx"      # or .p12
export CSC_KEY_PASSWORD="your-password"
export CSC_IDENTITY_AUTO_DISCOVERY=true   # auto-find cert in Windows cert store
```

electron-builder will sign both `FinFlow.exe` and the NSIS installer.

---

## Build for other platforms

| Platform | Command | Output |
|----------|---------|--------|
| Windows | `npm run dist:win` | `release/FinFlow-Setup-1.0.0.exe` |
| macOS   | `npm run dist:mac` | `release/FinFlow-1.0.0.dmg` |
| Linux   | `npm run dist:linux` | `release/FinFlow-1.0.0.AppImage` + `.deb` |

> macOS builds must run on macOS (Apple notarization requires it).
> Linux AppImage runs on any distro without installation.

---

## Troubleshooting

**"server.js missing — run the build first."**
You launched the packaged app without building. Run `npm run dist:win` (which
includes the build step) instead of launching Electron directly on an unbuilt
project.

**Blank window / connection refused on port 3310.**
The bundled Next.js server failed to start. Open DevTools (View → Toggle
DevTools, or `Ctrl+Shift+I`) and check the terminal output for the error.
Common cause: a corrupted `finflow.db` — delete `%APPDATA%\FinFlow\finflow.db`
and relaunch to recreate it.

**Prisma engine mismatch on first run.**
The standalone build may pin a specific Prisma engine. If the first-run
schema push fails, run `npm run electron:build` again to regenerate the
client, then rebuild the installer.

**App won't launch after update.**
Delete `%APPDATA%\FinFlow\` and relaunch. (This wipes your database — export
your data first via the Data Manager view if possible.)

---

## Project structure

```
my-project/
├── electron/
│   ├── main.cjs              # Electron main process (server lifecycle + window)
│   ├── preload.cjs           # Secure context bridge
│   └── build/
│       ├── icon.png          # App icon (512×512, also used by Linux)
│       ├── icon.ico          # Windows multi-size icon
│       └── generate-icons.cjs # regenerates icons from an SVG definition
├── prisma/
│   └── schema.prisma         # 16-model database schema (bundled as extraResource)
├── src/                      # Next.js app (UI + API routes + lib)
│   └── lib/db.ts             # Prisma client — reads FINFLOW_DB_PATH env
├── next.config.ts            # output: "standalone" (already configured)
└── package.json              # electron-builder config in the "build" field
```

---

## Verifying the build locally (without Windows)

Even if you're on macOS/Linux, you can verify the build pipeline:

```bash
npm run electron:build      # produces .next/standalone/
node .next/standalone/server.js   # serve it on a port manually
curl http://localhost:3000/api/health   # should return {"status":"ok"}
```

If that works, the Windows packaging (`dist:win`) will work too — it just
wraps the same standalone server in an Electron shell.
