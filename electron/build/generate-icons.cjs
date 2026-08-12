const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const outDir = __dirname;

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
  <rect x="0" y="0" width="1024" height="1024" rx="220" ry="220" fill="url(#bg)"/>
  <rect x="80" y="80" width="864" height="864" rx="170" ry="170" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.18"/>
  <g filter="url(#shadow)">
    <ellipse cx="512" cy="560" rx="280" ry="200" fill="url(#pig)"/>
    <rect x="360" y="700" width="60" height="90" rx="20" fill="url(#pig)"/>
    <rect x="604" y="700" width="60" height="90" rx="20" fill="url(#pig)"/>
    <path d="M690 430 q40 -60 110 -40 q-10 70 -80 80 z" fill="url(#pig)"/>
    <circle cx="640" cy="500" r="22" fill="#065f46"/>
    <rect x="430" y="395" width="180" height="22" rx="11" fill="#065f46" opacity="0.55"/>
    <circle cx="520" cy="360" r="62" fill="#fbbf24"/>
    <circle cx="520" cy="360" r="62" fill="none" stroke="#f59e0b" stroke-width="6"/>
    <text x="520" y="386" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#92400e">Rs</text>
  </g>
</svg>`;

function buildIco(pngBuffers) {
  const sizes = [...pngBuffers.keys()].sort((a, b) => a - b);
  const count = sizes.length;
  const headerSize = 6 + count * 16;
  let totalSize = headerSize;
  for (const s of sizes) totalSize += pngBuffers.get(s).length;
  const buf = Buffer.alloc(totalSize);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let offset = headerSize;
  sizes.forEach((s, i) => {
    const entryOff = 6 + i * 16;
    const png = pngBuffers.get(s);
    buf.writeUInt8(s >= 256 ? 0 : s, entryOff);
    buf.writeUInt8(s >= 256 ? 0 : s, entryOff + 1);
    buf.writeUInt8(0, entryOff + 2);
    buf.writeUInt8(0, entryOff + 3);
    buf.writeUInt16LE(1, entryOff + 4);
    buf.writeUInt16LE(32, entryOff + 6);
    buf.writeUInt32LE(png.length, entryOff + 8);
    buf.writeUInt32LE(offset, entryOff + 12);
    png.copy(buf, offset);
    offset += png.length;
  });
  return buf;
}

async function main() {
  const icoSizes = [16, 32, 48, 64, 256];
  const pngMap = new Map();
  for (const s of icoSizes) {
    const png = await sharp(Buffer.from(svg(s))).png().toBuffer();
    pngMap.set(s, png);
    fs.writeFileSync(path.join(outDir, `icon-${s}.png`), png);
  }
  const big = await sharp(Buffer.from(svg(512))).png().toBuffer();
  fs.writeFileSync(path.join(outDir, "icon.png"), big);
  fs.writeFileSync(path.join(outDir, "icon-512.png"), big);
  fs.writeFileSync(path.join(outDir, "icon-128.png"), await sharp(Buffer.from(svg(128))).png().toBuffer());
  fs.writeFileSync(path.join(outDir, "icon-1024.png"), await sharp(Buffer.from(svg(1024))).png().toBuffer());
  const ico = buildIco(pngMap);
  fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
  console.log("Icons generated - icon.ico is " + ico.length + " bytes");
}

main().catch((e) => { console.error(e); process.exit(1); });
