// Cross-platform post-build step.
// Copies the static assets + public folder into the Next.js standalone dir
// so the standalone server.js can serve them. Replaces `cp -r` which only
// works on Unix shells.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[postbuild] Source not found, skipping: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log("[postbuild] Copying .next/static → standalone/.next/static …");
copyDir(staticSrc, staticDest);
console.log("[postbuild] Copying public → standalone/public …");
copyDir(publicSrc, publicDest);
console.log("[postbuild] Done ✓");
