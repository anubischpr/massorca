// Kept in memory on the host that runs the query: a restart drops the in-flight replies with their work.
const replyingByTeam = new Map<string, Map<string, number>>()

export function markBotTeamReplying(teamId: string, botId: string, now = Date.now()): void {
  const bots = replyingByTeam.get(teamId) ?? new Map<string, number>()
  bots.set(botId, now)
  replyingByTeam.set(teamId, bots)
}

export function clearBotTeamReplying(teamId: string, botId: string): void {
  const bots = replyingByTeam.get(teamId)
  bots?.delete(botId)
  if (bots?.size === 0) {
    replyingByTeam.delete(teamId)
  }
}

/** The bots answering in the room right now, oldest first. */
export function listBotTeamReplying(teamId: string): { botId: string; since: number }[] {
  return [...(replyingByTeam.get(teamId) ?? [])].map(([botId, since]) => ({ botId, since }))
}

const REMEMBER_POST_MS = 10 * 60_000
const rememberedPosts = new Map<string, { at: number; result: Promise<unknown> }>()

/**
 * A client that resends the same send (same id) gets the first result back instead of a second
 * message. A repeat that arrives mid-decision shares the first run. Failures are not remembered.
 */
export function rememberBotTeamPost<T>(
  teamId: string,
  clientRequestId: string | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (clientRequestId === undefined) {
    return run()
  }
  const now = Date.now()
  for (const [key, entry] of rememberedPosts) {
    if (now - entry.at > REMEMBER_POST_MS) {
      rememberedPosts.delete(key)
    }
  }
  const key = `${teamId}\u0000${clientRequestId}`
  const known = rememberedPosts.get(key)
  if (known) {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a client reuses one id for one send, so the stored promise came from the same `run`.
    return known.result as Promise<T>
  }
  const result = run()
  rememberedPosts.set(key, { at: now, result })
  result.catch(() => rememberedPosts.delete(key))
  return result
}
