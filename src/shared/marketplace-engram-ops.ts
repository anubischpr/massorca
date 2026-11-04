/** Engram maintenance from the Marketplace: program version, update, memory import. */

export type EngramProgramInfo = {
  found: boolean
  current: string | null
  /** The newer release the CLI reports, when it reports one. */
  latest: string | null
  updateAvailable: boolean
}

export type EngramUpdateResult =
  | { ok: true; info: EngramProgramInfo }
  | {
      ok: false
      reason: 'not-installed' | 'manual' | 'failed'
      /** What to do by hand when MassOrca has no safe command to run. */
      instruction?: string
      url?: string
    }

export type EngramImportCounts = {
  observations?: number
  sessions?: number
  prompts?: number
}

export type EngramImportResult =
  | { ok: true; counts: EngramImportCounts }
  | {
      ok: false
      reason: 'canceled' | 'not-installed' | 'not-json' | 'too-large' | 'unreadable' | 'failed'
    }

export type MarketplaceEngramOpsApi = {
  getProgram: () => Promise<EngramProgramInfo>
  updateNow: () => Promise<EngramUpdateResult>
  /** Opens the file picker in main, so the renderer never hands over a path. */
  importMemories: () => Promise<EngramImportResult>
}
