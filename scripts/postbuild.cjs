const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");
const envFile = path.join(standaloneDir, ".env");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) { console.warn("[postbuild] Source not found, skipping: " + src); return; }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) { copyDir(s, d); } else { fs.copyFileSync(s, d); }
  }
}

console.log("[postbuild] Copying .next/static -> standalone/.next/static");
copyDir(staticSrc, staticDest);
console.log("[postbuild] Copying public -> standalone/public");
copyDir(publicSrc, publicDest);

// Remove the generated .env - it contains the build machine DATABASE_URL
// which would override the runtime FINFLOW_DB_PATH we set in electron/main.cjs.
if (fs.existsSync(envFile)) {
  fs.unlinkSync(envFile);
  console.log("[postbuild] Removed standalone/.env (prevents DB path override)");
}

console.log("[postbuild] Done");