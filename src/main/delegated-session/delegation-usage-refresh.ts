const USAGE_REFRESH_WAIT_MS = 8_000

/**
 * Lets a stale host meter refresh before the router reads it, since the meter polls no faster than
 * the router's freshness window. A slow read keeps going for the next reader; a failed one leaves
 * the last sample to the router's own checks.
 */
export async function waitForDelegationUsageRefresh(
  refreshUsage: () => Promise<void>,
  waitMs: number = USAGE_REFRESH_WAIT_MS
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, waitMs)
  })
  try {
    await Promise.race([refreshUsage(), timedOut])
  } catch {
    // The router treats whatever the meter still holds on its own terms.
  } finally {
    clearTimeout(timer)
  }
}
