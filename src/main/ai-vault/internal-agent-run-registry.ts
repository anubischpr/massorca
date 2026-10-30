// Records each background agent run MassOrca starts (chat naming, commit messages, PR text, ...)
// when it spawns, so Session History can mark the transcript it leaves behind as automated without
// reading titles. Disabled until the composition root calls init; every failure degrades to the
// prompt-prefix fallback in the list.
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

// A transcript is judged long after the run, so keep the record well past a typical history view.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const MAX_RUNS = 1000
const SAVE_DEBOUNCE_MS = 1_000
const FILE_VERSION = 1

export type InternalAgentRun = {
  /** Agent id the run was configured with; 'custom' (or an id the vault does not list) matches any agent. */
  agentId: string
  cwd: string
  startedAtMs: number
  /** Null while the run is in flight, or when the app quit before it finished. */
  endedAtMs: number | null
}

let filePath: string | null = null
let runs: InternalAgentRun[] = []
let saveTimer: NodeJS.Timeout | null = null

export function initInternalAgentRunRegistry(
  options: { filePath: string },
  nowMs = Date.now()
): void {
  filePath = options.filePath
  runs = loadRuns(options.filePath, nowMs)
}

export function resetInternalAgentRunRegistryForTests(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  filePath = null
  runs = []
}

/** Marks the start of a background run; the returned function records that it ended. */
export function recordInternalAgentRunStart(
  input: { agentId: string; cwd: string },
  nowMs = Date.now()
): () => void {
  const run: InternalAgentRun = {
    agentId: input.agentId,
    cwd: input.cwd,
    startedAtMs: nowMs,
    endedAtMs: null
  }
  runs.push(run)
  if (runs.length > MAX_RUNS) {
    runs = runs.slice(runs.length - MAX_RUNS)
  }
  scheduleSave()
  return () => {
    run.endedAtMs = Date.now()
    scheduleSave()
  }
}

export function listInternalAgentRuns(): readonly InternalAgentRun[] {
  return runs
}

function loadRuns(path: string, nowMs: number): InternalAgentRun[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!isRecord(parsed) || parsed.version !== FILE_VERSION || !Array.isArray(parsed.runs)) {
      return []
    }
    const loaded: InternalAgentRun[] = []
    for (const entry of parsed.runs) {
      const run = toRun(entry)
      if (run && nowMs - run.startedAtMs < RETENTION_MS) {
        loaded.push(run)
      }
    }
    return loaded.slice(-MAX_RUNS)
  } catch {
    return []
  }
}

function toRun(value: unknown): InternalAgentRun | null {
  if (
    !isRecord(value) ||
    typeof value.agentId !== 'string' ||
    typeof value.cwd !== 'string' ||
    typeof value.startedAtMs !== 'number'
  ) {
    return null
  }
  return {
    agentId: value.agentId,
    cwd: value.cwd,
    startedAtMs: value.startedAtMs,
    endedAtMs: typeof value.endedAtMs === 'number' ? value.endedAtMs : null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function scheduleSave(): void {
  if (!filePath || saveTimer) {
    return
  }
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveRuns()
  }, SAVE_DEBOUNCE_MS)
  saveTimer.unref()
}

function saveRuns(): void {
  if (!filePath) {
    return
  }
  const tempPath = `${filePath}.tmp`
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify({ version: FILE_VERSION, runs }))
    renameSync(tempPath, filePath)
  } catch (error) {
    // Why: losing the record only loses the creation-time mark; the prefix fallback still applies.
    console.warn('[ai-vault] internal agent runs could not be saved', error)
    rmSync(tempPath, { force: true })
  }
}
