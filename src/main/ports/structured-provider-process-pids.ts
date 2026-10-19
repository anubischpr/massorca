const providerPids = new Set<number>()

/** Remembers a structured chat's provider child so its own listeners are not read as workspace servers. */
export function noteStructuredProviderProcess(pid: number): void {
  providerPids.add(pid)
}

export function structuredProviderProcessPids(): ReadonlySet<number> {
  for (const pid of providerPids) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      // Only ESRCH proves the pid is gone; anything else keeps it, failing toward exclusion.
      if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
        providerPids.delete(pid)
      }
    }
  }
  return providerPids
}
