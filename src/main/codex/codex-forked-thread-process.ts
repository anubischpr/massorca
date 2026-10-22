import { openCodexAppServerConnection } from './codex-app-server-connection'
import { readRecord, readString } from './codex-item-field-readers'
import type { CodexStructuredLaunch } from './codex-structured-session-state'

// A thread stays loaded, and writable, in the app-server that forked it. The chat that adopts the
// fork starts an app-server of its own, whose `thread/resume` Codex refuses ("already has an active
// writer") for as long as the first one runs: unsubscribing does not unload the thread. So the fork
// is made by a child that exits right after, which is what releases it.

const launches = new Map<string, CodexStructuredLaunch>()

/** The launch a session's app-server was started with, for work that needs a sibling process. */
export function rememberCodexSessionLaunch(sessionId: string, launch: CodexStructuredLaunch): void {
  launches.set(sessionId, launch)
}

/**
 * Forks `threadId` in a short-lived app-server and returns the new thread's id once that process
 * has exited. Null when this session's launch is unknown or the child could not do it, in which
 * case the caller forks in the session's own process.
 */
export async function forkCodexThreadInOwnProcess(
  sessionId: string,
  threadId: string,
  timeoutMs: number | undefined
): Promise<string | null> {
  const launch = launches.get(sessionId)
  if (!launch) {
    return null
  }
  let connection: Awaited<ReturnType<typeof openCodexAppServerConnection>> | null = null
  try {
    connection = await openCodexAppServerConnection({
      command: launch.command,
      args: launch.args,
      cwd: launch.cwd,
      // Not the session's own identity or spawn token: this child is not the session.
      env: {
        ...launch.env,
        ...(launch.codexHome ? { CODEX_HOME: launch.codexHome } : {})
      }
    })
    const response = await connection.request(
      'thread/fork',
      { threadId, excludeTurns: true },
      { timeoutMs }
    )
    return readString(readRecord(readRecord(response).thread), 'id')
  } catch {
    return null
  } finally {
    // Closed even after a failure: a child left running keeps whatever it loaded.
    await connection?.close().catch(() => false)
  }
}
