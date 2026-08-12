// Generates the FinFlow app icons (icon.png, icon.ico, icon.icns sources)
// into electron/build/. Run with: node electron/build/generate-icons.cjs
const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs");

const outDir = __dirname;

// A 1024x1024 emerald gradient FinFlow mark with a piggy-bank + rupee motif.
// Drawn as an SVG so we can rasterise at any size.
const svg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#0d9488"/>
    </linearGradient>
    <linearGradient id="pig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#ecfdf5"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#065f46" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Rounded square background -->
  <rect x="0" y="0" width="1024" height="1024" rx="220" ry="220" fill="url(#bg)"/>
  <!-- Soft inner highlight -->
  <rect x="80" y="80" width="864" height="864" rx="170" ry="170" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.18"/>
  <!-- Piggy bank body -->
  <g filter="url(#shadow)">
    <ellipse cx="512" cy="560" rx="280" ry="200" fill="url(#pig)"/>
    <!-- legs -->
    <rect x="360" y="700" width="60" height="90" rx="20" fill="url(#pig)"/>
    <rect x="604" y="700" width="60" height="90" rx="20" fill="url(#pig)"/>
    <!-- ear -->
    <path d="M690 430 q40 -60 110 -40 q-10 70 -80 80 z" fill="url(#pig)"/>
    <!-- eye -->
    <circle cx="640" cy="500" r="22" fill="#065f46"/>
    <!-- coin slot -->
    <rect x="430" y="395" width="180" height="22" rx="11" fill="#065f46" opacity="0.55"/>
    <!-- coin -->
    <circle cx="520" cy="360" r="62" fill="#fbbf24"/>
    <circle cx="520" cy="360" r="62" fill="none" stroke="#f59e0b" stroke-width="6"/>
    <text x="520" y="386" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#92400e">₹</text>
  </g>
</svg>`;

async function main() {
  // 1024 master + the sizes electron-builder needs.
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const buffers = await Promise.all(
    sizes.map((s) => sharp(Buffer.from(svg(s))).png().toBuffer()),
  );
  // Write each png
  for (let i = 0; i < sizes.length; i++) {
    fs.writeFileSync(path.join(outDir, `icon-${sizes[i]}.png`), buffers[i]);
  }
  // Master icon.png (512 for reference)
  fs.writeFileSync(path.join(outDir, "icon.png"), buffers[6]);
  // ICO: a multi-size icon. Built by concatenating the ICO header + each PNG.
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoPngs = icoSizes.map((s) => buffers[sizes.indexOf(s)]);
  const headerSize = 6 + icoPngs.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(icoPngs.length, 4); // count
  let offset = headerSize;
  icoPngs.forEach((png, i) => {
    const s = icoSizes[i];
    header.writeUInt8(s >= 256 ? 0 : s, 6 + i * 16);
    header.writeUInt8(s >= 256 ? 0 : s, 7 + i * 16);
    header.writeUInt16LE(0, 8 + i * 16);
    header.writeUInt16LE(32, 10 + i * 16);
    header.writeUInt32LE(png.length, 12 + i * 16);
    header.writeUInt32LE(offset, 16 + i * 16);
    offset += png.length;
  });
  const ico = Buffer.concat([header, ...icoPngs]);
  fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
  console.log("Icons generated:", {
    png: sizes.map((s) => `icon-${s}.png`),
    icon_png: "icon.png",
    icon_ico: "icon.ico",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
