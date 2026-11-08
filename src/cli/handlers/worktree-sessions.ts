import type {
  RuntimeTerminalClose,
  RuntimeWorktreePsResult,
  RuntimeWorktreeRecord
} from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { reportCliError } from '../cli-error'
import { printResult } from '../format'
import { getRequiredStringFlag } from '../flags'
import { RuntimeClientError, type RuntimeClient } from '../runtime-client'
import { getRequiredWorktreeSelector } from '../selectors'
import {
  formatWorktreeAgentSessions,
  projectWorktreeAgentSession,
  type WorktreeAgentSession
} from '../worktree-agent-sessions'
import { terminalCloseFailure } from './terminal-close'

// Why: worktree.ps pages its rows, and a worktree past the first page would look session-less.
// resolveCurrentWorktreeSelector reads the whole catalog the same way (worktree.list, 10_000).
const ALL_WORKTREES_LIMIT = 10_000

async function readWorktreeSessions(client: RuntimeClient, selector: string) {
  const shown = await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
    worktree: selector
  })
  const ps = await client.call<RuntimeWorktreePsResult>('worktree.ps', {
    limit: ALL_WORKTREES_LIMIT
  })
  const worktreeId = shown.result.worktree.id
  const summary = ps.result.worktrees.find((candidate) => candidate.worktreeId === worktreeId)
  const sessions = summary ? summary.agents.map(projectWorktreeAgentSession) : []
  return { envelope: ps, worktreeId, sessions }
}

async function closeTerminalSession(
  client: RuntimeClient,
  session: WorktreeAgentSession,
  json: boolean
): Promise<void> {
  const response = await client.call<{ close: RuntimeTerminalClose }>('terminal.close', {
    terminal: session.id
  })
  const failure = terminalCloseFailure(response.result.close)
  if (failure) {
    reportCliError(failure, json)
    process.exitCode = 1
    return
  }
  printResult(
    { ...response, result: { session, close: response.result.close } },
    json,
    () => `Closed terminal ${session.id}.`
  )
}

async function callAgentSessionClose(client: RuntimeClient, sessionId: string) {
  try {
    return await client.call<{ ok: true }>('agentSession.close', { sessionId })
  } catch (error) {
    if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This MassOrca host cannot close chat sessions from the CLI yet. Update MassOrca on the host and try again.'
      )
    }
    throw error
  }
}

async function closeChatSession(
  client: RuntimeClient,
  session: WorktreeAgentSession,
  json: boolean
): Promise<void> {
  const response = await callAgentSessionClose(client, session.id)
  printResult(
    { ...response, result: { session } },
    json,
    () => `Closed chat session ${session.id}.`
  )
}

export const WORKTREE_SESSION_HANDLERS: Record<string, CommandHandler> = {
  'worktree sessions': async ({ flags, client, cwd, json }) => {
    const selector = await getRequiredWorktreeSelector(flags, 'worktree', cwd, client)
    const { envelope, worktreeId, sessions } = await readWorktreeSessions(client, selector)
    printResult({ ...envelope, result: { worktreeId, sessions } }, json, (value) =>
      formatWorktreeAgentSessions(value.sessions, Date.now())
    )
  },
  'worktree session-close': async ({ flags, client, cwd, json }) => {
    const id = getRequiredStringFlag(flags, 'session')
    const selector = await getRequiredWorktreeSelector(flags, 'worktree', cwd, client)
    const { sessions } = await readWorktreeSessions(client, selector)
    const session = sessions.find((candidate) => candidate.id === id)
    if (!session) {
      throw new RuntimeClientError(
        'agent_session_not_found',
        `No agent session "${id}" in this worktree. List them with: orca worktree sessions --worktree <selector>`
      )
    }
    if (session.kind === null) {
      throw new RuntimeClientError(
        'agent_session_not_closable',
        `Agent session "${id}" has no terminal or chat the CLI can close. Close it in MassOrca instead.`
      )
    }
    if (session.kind === 'terminal') {
      await closeTerminalSession(client, session, json)
      return
    }
    await closeChatSession(client, session, json)
  }
}
