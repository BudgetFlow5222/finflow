import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Resolve the SQLite database path.
//
// - In the sandbox / dev:  use the DATABASE_URL from .env (absolute path in db/).
// - In a packaged Electron app: the app bundle is read-only, so the DB must
//   live in the OS user-data dir. The Electron main process sets
//   FINFLOW_DB_PATH (absolute) before spawning the Next.js server; we prefer
//   that, then fall back to DATABASE_URL, then to a local ./db/custom.db.
function resolveDatabaseUrl(): string {
  const explicit = process.env.FINFLOW_DB_PATH
  if (explicit) {
    // Ensure the parent directory exists (the packaged app's userData dir
    // always exists, but be defensive).
    const dir = dirname(explicit)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return `file:${explicit}`
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return 'file:./db/custom.db'
}

const databaseUrl = resolveDatabaseUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    datasources: { db: { url: databaseUrl } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
