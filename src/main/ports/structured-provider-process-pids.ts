import {
  PROCESS_START_TIME_TOLERANCE_MS,
  readProcessStartTimeMs
} from '../runtime/agent-session-process-identity-probe'

const providerProcesses = new Map<number, number>()

/** Remembers a structured chat's provider child so its own listeners are not read as workspace servers. */
export function noteStructuredProviderProcess(process: {
  pid: number
  processStartTimeMs: number | null
}): void {
  // Without a start time a reused pid could not be told apart, so it is not trusted at all.
  if (process.processStartTimeMs !== null) {
    providerProcesses.set(process.pid, process.processStartTimeMs)
  }
}

export function releaseStructuredProviderProcess(pid: number): void {
  providerProcesses.delete(pid)
}

/** Pids whose start time still matches their registration; any failed or mismatching probe drops the entry. */
export async function structuredProviderProcessPids(
  readStartTime: (pid: number) => Promise<number | null> = readProcessStartTimeMs
): Promise<ReadonlySet<number>> {
  await Promise.all(
    [...providerProcesses].map(async ([pid, registered]) => {
      const current = await readStartTime(pid).catch(() => null)
      if (current === null || Math.abs(current - registered) > PROCESS_START_TIME_TOLERANCE_MS) {
        providerProcesses.delete(pid)
      }
    })
  )
  return new Set(providerProcesses.keys())
}
