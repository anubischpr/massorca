/** Waits for the timeline to drain, but never past a bound: a stuck write must not hold the exit back. */
export async function awaitTimelineDrain(
  lane: { drained(): Promise<void> },
  onTimeout: () => void,
  boundMs = 2_000
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      lane.drained(),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          onTimeout()
          resolve()
        }, boundMs)
        timer.unref()
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
