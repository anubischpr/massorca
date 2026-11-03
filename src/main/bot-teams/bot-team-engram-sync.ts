import type { EngramRunner } from './bot-team-engram-reader'

/** A real import takes about 43 s on a PC; killing it partway wastes the work. */
export const ENGRAM_IMPORT_TIMEOUT_MS = 120_000
/** Minimum gap between cloud imports of one project on this host. */
export const ENGRAM_SYNC_INTERVAL_MS = 5 * 60_000

/** An engram without `sync --import` prints its usage text and may still exit 0. */
const OLD_CLI_USAGE = /^usage: engram sync\b/m

type ProjectImport = {
  startedAt: number | null
  failed: boolean
  inFlight: Promise<boolean> | null
}

export type EngramCloudSync = {
  /** Pulls the project from the Engram server into the local store; resolves true when it failed. Never rejects. */
  refresh: (run: EngramRunner, project: string, options: { force: boolean }) => Promise<boolean>
  /** Synchronous: whether an import is running now, and whether the last settled one failed. */
  status: (project: string) => { importing: boolean; failed: boolean }
}

/** In memory, per host: a restart starts with no throttle. */
export function createEngramCloudSync(options: { now?: () => number } = {}): EngramCloudSync {
  const now = options.now ?? (() => Date.now())
  const projects = new Map<string, ProjectImport>()

  const importOnce = async (run: EngramRunner, project: string): Promise<boolean> => {
    try {
      const result = await run(['sync', '--import', '--cloud', '--project', project], {
        timeoutMs: ENGRAM_IMPORT_TIMEOUT_MS
      })
      return result.timedOut || result.code !== 0 || OLD_CLI_USAGE.test(result.stdout)
    } catch {
      return true
    }
  }

  return {
    status: (project) => {
      const state = projects.get(project)
      return { importing: state?.inFlight != null, failed: state?.failed ?? false }
    },
    refresh: async (run, project, { force }) => {
      const state = projects.get(project) ?? { startedAt: null, failed: false, inFlight: null }
      projects.set(project, state)
      if (state.inFlight) {
        return state.inFlight
      }
      const at = now()
      if (!force && state.startedAt !== null && at - state.startedAt < ENGRAM_SYNC_INTERVAL_MS) {
        return state.failed
      }
      state.startedAt = at
      const attempt = importOnce(run, project).then((failed) => {
        state.failed = failed
        state.inFlight = null
        return failed
      })
      state.inFlight = attempt
      return attempt
    }
  }
}
