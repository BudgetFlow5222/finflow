const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const seedDbPath = path.join(root, "prisma", "seed.db");
const schemaPath = path.join(root, "prisma", "schema.prisma");

if (fs.existsSync(seedDbPath)) fs.unlinkSync(seedDbPath);

console.log("[prepare-seed-db] Creating empty database with schema...");
console.log("  schema:", schemaPath);
console.log("  output:", seedDbPath);

try {
  // Use execFileSync (not execSync) so the schema path is passed as a single
  // argument even when it contains spaces (e.g. "C:\Users\Saddam Ansari\...").
  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [
    prismaCli,
    "db", "push",
    "--schema", schemaPath,
  ], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:" + seedDbPath },
  });
  const size = fs.statSync(seedDbPath).size;
  console.log("[prepare-seed-db] Seed database created (" + size + " bytes)");
} catch (e) {
  console.error("[prepare-seed-db] FAILED:", e.message);
  process.exit(1);
}