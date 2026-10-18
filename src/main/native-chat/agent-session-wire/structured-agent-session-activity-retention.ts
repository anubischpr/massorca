export const MAX_RETAINED_SESSION_ACTIVITIES = 512

/** Keeps the newest value per session, dropping the least recently set past the bound. */
export function rememberSessionActivity<T>(
  activities: Map<string, T>,
  sessionId: string,
  activity: T
): void {
  activities.delete(sessionId)
  activities.set(sessionId, activity)
  while (activities.size > MAX_RETAINED_SESSION_ACTIVITIES) {
    const oldest = activities.keys().next()
    if (oldest.done || oldest.value === sessionId) {
      break
    }
    activities.delete(oldest.value)
  }
}
