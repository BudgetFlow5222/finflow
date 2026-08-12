import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

function resolveDatabaseUrl(): string {
  const explicit = process.env.FINFLOW_DB_PATH
  if (explicit) {
    const dir = dirname(explicit)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return `file:${explicit}`
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return 'file:./db/custom.db'
}

function findAndSetEnginePath() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return
  const candidates: string[] = []
  if (process.resourcesPath && existsSync(process.resourcesPath)) {
    candidates.push(
      join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'node_modules', '.prisma', 'client'),
      join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client'),
      join(process.resourcesPath, 'standalone', 'node_modules', '.prisma', 'client'),
      join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'node_modules', '@prisma', 'engines'),
    )
  }
  candidates.push(
    join(process.cwd(), 'node_modules', '.prisma', 'client'),
    join(__dirname, '..', '..', 'node_modules', '.prisma', 'client'),
  )
  for (const dir of candidates) {
    if (!existsSync(dir)) continue
    try {
      const files = readdirSync(dir)
      const engine = files.find(f => f.startsWith('query_engine-') || f.startsWith('libquery_engine-'))
      if (engine) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = join(dir, engine)
        console.log('[db] Set PRISMA_QUERY_ENGINE_LIBRARY:', process.env.PRISMA_QUERY_ENGINE_LIBRARY)
        return
      }
    } catch {}
  }
  console.warn('[db] Could not find Prisma query engine binary')
}

findAndSetEnginePath()

const databaseUrl = resolveDatabaseUrl()
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
    datasources: { db: { url: databaseUrl } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db