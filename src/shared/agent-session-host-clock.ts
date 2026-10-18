/** The last host clock sample: `hostNow - receivedAt` is the client's skew from the host,
 *  which is what lets a client attaching mid-turn anchor its live counter on the real start. */
export type StructuredAgentHostClock = {
  hostNow: number
  receivedAt: number
}

/** A frame without `hostNow` (older host) leaves the previous sample in place. */
export function hostClockField(
  hostNow: number | undefined,
  receivedAt: number,
  previous: StructuredAgentHostClock | undefined
): { hostClock?: StructuredAgentHostClock } {
  const hostClock = hostNow !== undefined ? { hostNow, receivedAt } : previous
  return hostClock ? { hostClock } : {}
}
