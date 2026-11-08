import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { MarketplaceCustomItem } from '../../../shared/marketplace-custom'

/** A custom item as kept on disk, with when MassOrca installed it, if it did. */
export type StoredCustomItem = MarketplaceCustomItem & { massorcaInstalledAt?: number }

export type CustomItemStore = {
  /** [] when no file exists yet; null when the file exists but cannot be read, so no write may replace it. */
  read: () => StoredCustomItem[] | null
  write: (items: readonly StoredCustomItem[]) => void
}

const storedItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['tool', 'agent', 'skill']),
  name: z.string().min(1),
  checkCommand: z.array(z.string()).nullable(),
  install: z.partialRecord(z.enum(['win32', 'darwin', 'linux']), z.array(z.string())),
  skillUrl: z.string().optional(),
  createdAt: z.number(),
  massorcaInstalledAt: z.number().optional()
})

const fileSchema = z.object({ version: z.literal(1), items: z.array(storedItemSchema) })

function parseItems(text: string): StoredCustomItem[] | null {
  try {
    const parsed = fileSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data.items : null
  } catch {
    return null
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/** `~/.orca/marketplace/custom.json` and the like: plain JSON, never a secret. */
export function createCustomItemStore(file: string): CustomItemStore {
  return {
    read() {
      let text: string
      try {
        text = readFileSync(file, 'utf8')
      } catch (error) {
        return isMissingFile(error) ? [] : null
      }
      return parseItems(text)
    },
    write(items) {
      mkdirSync(dirname(file), { recursive: true })
      // Why tmp then rename: a crash mid-write must not leave a half-written list behind.
      const tmp = `${file}.${process.pid}.tmp`
      try {
        writeFileSync(tmp, `${JSON.stringify({ version: 1, items }, null, 2)}\n`, 'utf8')
        renameSync(tmp, file)
      } catch (error) {
        rmSync(tmp, { force: true })
        throw error
      }
    }
  }
}
