import type { EngramRunner } from './bot-team-engram-reader'

/** A real import takes about 43 s on a PC; killing it partway wastes the work. */
export const ENGRAM_IMPORT_TIMEOUT_MS = 120_000
/** Minimum gap between cloud imports of one project on this host. */
export const ENGRAM_SYNC_INTERVAL_MS = 5 * 60_000

/** An engram without `sync --import` prints its usage text and may still exit 0. */
const OLD_CLI_USAGE = /^usage: engram sync\b/m
/** The engram CLI's own wording for a host with no cloud setup, in stdout or stderr. */
const NOT_CONFIGURED =
  /cloud (?:sync |server |server url |token |bearer token |configuration )?(?:is )?(?:not configured|is missing|is required)|cloud server is missing|engram cloud config\b/i

/** Why an import failed: no cloud setup on this host, or the server could not be reached. */
export type EngramImportProblem = 'not-configured' | 'unreachable'

type ProjectImport = {
  startedAt: number | null
  failed: boolean
  problem: EngramImportProblem | null
  inFlight: Promise<boolean> | null
}

export type EngramCloudSync = {
  /** Pulls the project from the Engram server into the local store; resolves true when it failed. Never rejects. */
  refresh: (run: EngramRunner, project: string, options: { force: boolean }) => Promise<boolean>
  /** Synchronous: whether an import is running now, and how the last settled one went. */
  status: (project: string) => {
    importing: boolean
    failed: boolean
    problem: EngramImportProblem | null
  }
}

/** In memory, per host: a restart starts with no throttle. */
export function createEngramCloudSync(options: { now?: () => number } = {}): EngramCloudSync {
  const now = options.now ?? (() => Date.now())
  const projects = new Map<string, ProjectImport>()

  const importOnce = async (
    run: EngramRunner,
    project: string
  ): Promise<EngramImportProblem | null> => {
    try {
      const result = await run(['sync', '--import', '--cloud', '--project', project], {
        timeoutMs: ENGRAM_IMPORT_TIMEOUT_MS
      })
      if (result.timedOut) {
        return 'unreachable'
      }
      if (NOT_CONFIGURED.test(`${result.stdout}\n${result.stderr ?? ''}`)) {
        return 'not-configured'
      }
      return result.code !== 0 || OLD_CLI_USAGE.test(result.stdout) ? 'unreachable' : null
    } catch {
      return 'unreachable'
    }
  }

  return {
    status: (project) => {
      const state = projects.get(project)
      return {
        importing: state?.inFlight != null,
        failed: state?.failed ?? false,
        problem: state?.problem ?? null
      }
    },
    refresh: async (run, project, { force }) => {
      const state = projects.get(project) ?? {
        startedAt: null,
        failed: false,
        problem: null,
        inFlight: null
      }
      projects.set(project, state)
      if (state.inFlight) {
        return state.inFlight
      }
      // A host with no cloud setup is not asked again by a poll; only a forced look asks.
      if (!force && state.problem === 'not-configured') {
        return state.failed
      }
      const at = now()
      if (!force && state.startedAt !== null && at - state.startedAt < ENGRAM_SYNC_INTERVAL_MS) {
        return state.failed
      }
      state.startedAt = at
      const attempt = importOnce(run, project).then((problem) => {
        state.problem = problem
        state.failed = problem !== null
        state.inFlight = null
        return state.failed
      })
      state.inFlight = attempt
      return attempt
    }
  }
}
