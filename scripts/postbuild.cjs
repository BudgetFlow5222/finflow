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

function removeBrokenSymlinks(dir) {
  let removed = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          fs.unlinkSync(full);
          console.log("[postbuild] Removed symlink: " + path.relative(root, full));
          removed++;
        } catch (e) { console.warn("[postbuild] Could not remove symlink: " + full + " - " + e.message); }
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(dir);
  return removed;
}

console.log("[postbuild] Copying .next/static -> standalone/.next/static");
copyDir(staticSrc, staticDest);
console.log("[postbuild] Copying public -> standalone/public");
copyDir(publicSrc, publicDest);

if (fs.existsSync(envFile)) {
  fs.unlinkSync(envFile);
  console.log("[postbuild] Removed standalone/.env (prevents DB path override)");
}

console.log("[postbuild] Scanning for symlinks in standalone...");
const removed = removeBrokenSymlinks(standaloneDir);
console.log("[postbuild] Removed " + removed + " symlink(s)");

console.log("[postbuild] Done");