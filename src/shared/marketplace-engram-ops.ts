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

/** One project Engram knows on this computer; only a name and a time, never contents. */
export type EngramCloudProject = {
  name: string
  /** Epoch ms of the last successful sync MassOrca ran for it; null when never. */
  lastSyncedAt: number | null
}

export type EngramCloudFailure = 'not-installed' | 'no-server' | 'failed'

export type EngramCloudProjectsResult =
  | { ok: true; projects: EngramCloudProject[] }
  | { ok: false; reason: EngramCloudFailure }

export type EngramCloudActionResult =
  | { ok: true; lastSyncedAt?: number }
  | { ok: false; reason: EngramCloudFailure | 'unknown-project' | 'timed-out' }

export type MarketplaceEngramOpsApi = {
  getProgram: () => Promise<EngramProgramInfo>
  updateNow: () => Promise<EngramUpdateResult>
  /** Projects and their sync state; needs the server and sign-in saved in the vault. */
  listCloudProjects: () => Promise<EngramCloudProjectsResult>
  enrollCloudProject: (args: { name: string }) => Promise<EngramCloudActionResult>
  /** Enrolls the project first when needed, then syncs it now. */
  syncCloudProject: (args: { name: string }) => Promise<EngramCloudActionResult>
  /** Opens the file picker in main, so the renderer never hands over a path. */
  importMemories: () => Promise<EngramImportResult>
}
