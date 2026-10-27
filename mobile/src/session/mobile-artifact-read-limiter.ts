/**
 * Runs at most `limit` tasks at once; the rest wait in arrival order. A finished or failed task
 * frees its slot, so one bad read never stalls the queue.
 */
export function createReadLimiter(
  limit: number
): <Result>(task: () => Promise<Result>) => Promise<Result> {
  let active = 0
  const waiting: Array<() => void> = []

  function pump(): void {
    while (active < limit) {
      const start = waiting.shift()
      if (!start) {
        return
      }
      active += 1
      start()
    }
  }

  return function run<Result>(task: () => Promise<Result>): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      waiting.push(() => {
        void Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            active -= 1
            pump()
          })
      })
      pump()
    })
  }
}

/** Thumbnails read at most two pages at a time, so a long Artifacts list stays light on the host. */
export const artifactThumbnailLimiter = createReadLimiter(2)
