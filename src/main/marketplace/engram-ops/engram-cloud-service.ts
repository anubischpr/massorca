import type {
  EngramCloudActionResult,
  EngramCloudProjectsResult
} from '../../../shared/marketplace-engram-ops'
import {
  isSafeEngramProjectName,
  parseEngramEnrollment,
  parseEngramProjectNames
} from './engram-cloud-output'

const LIST_TIMEOUT_MS = 60_000
const STATUS_TIMEOUT_MS = 60_000
const ENROLL_TIMEOUT_MS = 60_000
const SYNC_TIMEOUT_MS = 180_000

export type EngramCloudRun = (
  program: string,
  args: readonly string[],
  timeoutMs: number,
  env?: Record<string, string>
) => Promise<{ code: number | null; output: string }>

export type EngramCloudDeps = {
  resolveProgram: () => Promise<string | null>
  run: EngramCloudRun
  /** The server and sign-in saved in the vault, as env vars; empty when either is missing. */
  cloudEnv: () => Record<string, string>
  /** Epoch ms of each project's last sync that MassOrca ran. */
  loadSyncTimes: () => Promise<Record<string, number>>
  saveSyncTime: (name: string, at: number) => Promise<void>
  now: () => number
}

export type EngramCloudService = {
  listCloudProjects: () => Promise<EngramCloudProjectsResult>
  enrollCloudProject: (name: string) => Promise<EngramCloudActionResult>
  syncCloudProject: (name: string) => Promise<EngramCloudActionResult>
}

type Ready = { program: string; env: Record<string, string> }

export function createEngramCloudService(deps: EngramCloudDeps): EngramCloudService {
  async function prepare(): Promise<Ready | 'not-installed' | 'no-server'> {
    const program = await deps.resolveProgram()
    if (!program) {
      return 'not-installed'
    }
    const env = deps.cloudEnv()
    return Object.keys(env).length === 0 ? 'no-server' : { program, env }
  }

  /** Names come from the local list, so the renderer can never aim a command at anything else. */
  async function knownProjects(program: string): Promise<string[] | null> {
    try {
      const result = await deps.run(program, ['projects', 'list'], LIST_TIMEOUT_MS)
      return result.code === 0 ? parseEngramProjectNames(result.output) : null
    } catch {
      return null
    }
  }

  async function listCloudProjects(): Promise<EngramCloudProjectsResult> {
    const ready = await prepare()
    if (typeof ready === 'string') {
      return { ok: false, reason: ready }
    }
    const names = await knownProjects(ready.program)
    if (!names) {
      return { ok: false, reason: 'failed' }
    }
    const times = await deps.loadSyncTimes().catch((): Record<string, number> => ({}))
    return {
      ok: true,
      projects: names.map((name) => ({ name, lastSyncedAt: times[name] ?? null }))
    }
  }

  async function runCloud(
    ready: Ready,
    args: readonly string[],
    timeoutMs: number
  ): Promise<EngramCloudActionResult> {
    try {
      const result = await deps.run(ready.program, args, timeoutMs, ready.env)
      if (result.code === 0) {
        return { ok: true }
      }
      return { ok: false, reason: result.code === null ? 'timed-out' : 'failed' }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  }

  /** Common start of enroll and sync: Engram and the server are there, and the name is a project. */
  async function prepareProject(name: string): Promise<Ready | EngramCloudActionResult> {
    const ready = await prepare()
    if (typeof ready === 'string') {
      return { ok: false, reason: ready }
    }
    if (!isSafeEngramProjectName(name)) {
      return { ok: false, reason: 'unknown-project' }
    }
    const names = await knownProjects(ready.program)
    if (!names) {
      return { ok: false, reason: 'failed' }
    }
    return names.includes(name) ? ready : { ok: false, reason: 'unknown-project' }
  }

  function enrollArgs(name: string): string[] {
    return ['cloud', 'enroll', name, '--literal-project']
  }

  async function enrollCloudProject(name: string): Promise<EngramCloudActionResult> {
    const ready = await prepareProject(name)
    return 'program' in ready ? runCloud(ready, enrollArgs(name), ENROLL_TIMEOUT_MS) : ready
  }

  async function isEnrolled(ready: Ready, name: string): Promise<boolean | null> {
    try {
      const result = await deps.run(
        ready.program,
        ['cloud', 'status', '--project', name],
        STATUS_TIMEOUT_MS,
        ready.env
      )
      return result.code === 0 ? parseEngramEnrollment(result.output) : null
    } catch {
      return null
    }
  }

  async function syncCloudProject(name: string): Promise<EngramCloudActionResult> {
    const ready = await prepareProject(name)
    if (!('program' in ready)) {
      return ready
    }
    if ((await isEnrolled(ready, name)) === false) {
      const enrolled = await runCloud(ready, enrollArgs(name), ENROLL_TIMEOUT_MS)
      if (!enrolled.ok) {
        return enrolled
      }
    }
    const synced = await runCloud(
      ready,
      ['sync', '--cloud', '--project', name, '--literal-project'],
      SYNC_TIMEOUT_MS
    )
    if (!synced.ok) {
      return synced
    }
    const at = deps.now()
    await deps.saveSyncTime(name, at).catch(() => undefined)
    return { ok: true, lastSyncedAt: at }
  }

  return { listCloudProjects, enrollCloudProject, syncCloudProject }
}
