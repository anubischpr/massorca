import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { GitInstallStore, InstallsRecord } from './git-install-types'

const recordSchema = z.object({
  manager: z.enum(['winget', 'homebrew', 'xcode-clt', 'apt', 'dnf']),
  recordedAt: z.string()
})

const fileSchema = z.object({
  version: z.literal(1),
  tools: z.object({ git: recordSchema.optional() }),
  pending: z.object({ git: recordSchema.optional() })
})

export function emptyInstallsRecord(): InstallsRecord {
  return { version: 1, tools: {}, pending: {} }
}

/** A missing or unreadable file reads as empty; the next write replaces it. */
export function createInstallsStore(file: string): GitInstallStore {
  return {
    read() {
      try {
        const parsed = fileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
        return parsed.success ? parsed.data : emptyInstallsRecord()
      } catch {
        return emptyInstallsRecord()
      }
    },
    write(record) {
      mkdirSync(dirname(file), { recursive: true })
      // Why tmp then rename: a crash mid-write must not leave a half-written record behind.
      const tmp = `${file}.${process.pid}.tmp`
      writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
      renameSync(tmp, file)
    }
  }
}
