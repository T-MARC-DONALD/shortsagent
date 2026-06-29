import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'

// Ensure the db directory exists (for fresh deployments where it might not)
async function ensureDbDir() {
  try {
    // Parse the DATABASE_URL to find the db directory
    const dbUrl = process.env.DATABASE_URL ?? 'file:./db/custom.db'
    const match = dbUrl.match(/^file:(.+)$/)
    if (match) {
      const dbPath = match[1].startsWith('./') ? path.join(process.cwd(), match[1]) : match[1]
      const dbDir = path.dirname(dbPath)
      await fs.mkdir(dbDir, { recursive: true })
    }
  } catch (e) {
    console.error('[db] Failed to create db directory:', e)
  }
}

// Auto-initialize on module load
ensureDbDir().catch(() => {})

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
