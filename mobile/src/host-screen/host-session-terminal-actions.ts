import {
  sessionTerminalClose,
  sessionTerminalRename
} from '../session/mobile-session-write-operations'

type SessionClient = Parameters<typeof sessionTerminalRename.request>[0]

/** Renames a session's terminal through the session screen's own write. True when the host accepts it. */
export async function renameSessionTerminal(
  client: SessionClient,
  handle: string,
  title: string
): Promise<boolean> {
  const reply = await sessionTerminalRename.request(client, { terminal: handle, title })
  return sessionTerminalRename.interpret(reply).accepted
}

/** Closes a session's terminal through the session screen's own write. The worktree stays. */
export async function closeSessionTerminal(
  client: SessionClient,
  handle: string
): Promise<boolean> {
  const reply = await sessionTerminalClose.request(client, { terminal: handle })
  return sessionTerminalClose.interpret(reply).accepted
}
