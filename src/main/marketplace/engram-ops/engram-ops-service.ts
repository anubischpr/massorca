import { extname } from 'node:path'
import type {
  EngramImportResult,
  EngramProgramInfo,
  EngramUpdateResult
} from '../../../shared/marketplace-engram-ops'
import {
  parseEngramImportCounts,
  parseEngramVersionOutput,
  selectEngramUpdateAdvice
} from './engram-ops-output'

export const ENGRAM_IMPORT_MAX_BYTES = 256 * 1024 * 1024
const VERSION_TIMEOUT_MS = 5000
const IMPORT_TIMEOUT_MS = 120_000

export type EngramOpsRun = (
  program: string,
  args: readonly string[],
  timeoutMs: number
) => Promise<{ code: number | null; output: string }>

export type EngramOpsDeps = {
  resolveProgram: () => Promise<string | null>
  run: EngramOpsRun
  /** Asks the user for one file; null when they cancel. */
  pickFile: () => Promise<string | null>
  /** Size in bytes of a regular file, null when it cannot be read. */
  fileSize: (path: string) => Promise<number | null>
}

export type EngramOpsService = {
  getProgram: () => Promise<EngramProgramInfo>
  updateNow: () => Promise<EngramUpdateResult>
  importMemories: () => Promise<EngramImportResult>
}

const NOT_FOUND: EngramProgramInfo = {
  found: false,
  current: null,
  latest: null,
  updateAvailable: false
}

export function createEngramOpsService(deps: EngramOpsDeps): EngramOpsService {
  async function getProgram(): Promise<EngramProgramInfo> {
    const program = await deps.resolveProgram()
    if (!program) {
      return NOT_FOUND
    }
    try {
      const result = await deps.run(program, ['version'], VERSION_TIMEOUT_MS)
      const { current, latest } = parseEngramVersionOutput(result.output)
      return { found: true, current, latest, updateAvailable: latest !== null }
    } catch {
      return { found: true, current: null, latest: null, updateAvailable: false }
    }
  }

  async function updateNow(): Promise<EngramUpdateResult> {
    const program = await deps.resolveProgram()
    if (!program) {
      return { ok: false, reason: 'not-installed' }
    }
    let notice = ''
    try {
      notice = (await deps.run(program, ['version'], VERSION_TIMEOUT_MS)).output
    } catch {
      // The advice does not depend on the notice.
    }
    return { ok: false, reason: 'manual', ...selectEngramUpdateAdvice(notice) }
  }

  async function importMemories(): Promise<EngramImportResult> {
    const program = await deps.resolveProgram()
    if (!program) {
      return { ok: false, reason: 'not-installed' }
    }
    const file = await deps.pickFile()
    if (!file) {
      return { ok: false, reason: 'canceled' }
    }
    if (extname(file).toLowerCase() !== '.json') {
      return { ok: false, reason: 'not-json' }
    }
    const size = await deps.fileSize(file)
    if (size === null) {
      return { ok: false, reason: 'unreadable' }
    }
    if (size > ENGRAM_IMPORT_MAX_BYTES) {
      return { ok: false, reason: 'too-large' }
    }
    try {
      const result = await deps.run(program, ['import', file], IMPORT_TIMEOUT_MS)
      return result.code === 0
        ? { ok: true, counts: parseEngramImportCounts(result.output) }
        : { ok: false, reason: 'failed' }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  }

  return { getProgram, updateNow, importMemories }
}
