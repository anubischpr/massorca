import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { DelegatedChildLocation } from './mobile-delegated-child-access'

/** One agent pane a worktree lists, the pane key of the pane that spawned it, and the name the host lists it by. */
export type WorktreeAgentPane = { paneKey: string; parentPaneKey: string | null; title?: string }

/** The name a pane is listed by: its task title, else its display name; undefined when neither is text. */
function paneNameOf(agent: Record<string, unknown>): string | undefined {
  for (const value of [agent.taskTitle, agent.displayName]) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

export type WorktreeAgentRows = { worktreeId: string; agents: WorktreeAgentPane[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** worktree.ps rows read leniently: a row or pane this client cannot read is skipped, and a host from
 *  before `agents` lists none. */
export function worktreeAgentRowsFromCatalog(rows: readonly unknown[]): WorktreeAgentRows[] {
  const worktrees: WorktreeAgentRows[] = []
  for (const row of rows) {
    if (!isRecord(row) || typeof row.worktreeId !== 'string' || !Array.isArray(row.agents)) {
      continue
    }
    const agents: WorktreeAgentPane[] = []
    for (const agent of row.agents) {
      if (isRecord(agent) && typeof agent.paneKey === 'string' && agent.paneKey.length > 0) {
        const title = paneNameOf(agent)
        agents.push({
          paneKey: agent.paneKey,
          parentPaneKey: typeof agent.parentPaneKey === 'string' ? agent.parentPaneKey : null,
          ...(title === undefined ? {} : { title })
        })
      }
    }
    worktrees.push({ worktreeId: row.worktreeId, agents })
  }
  return worktrees
}

/** The tab part of a `<tabId>:<leafId>` pane key, or null when the key has no separator. */
export function paneTabIdOfPaneKey(paneKey: string): string | null {
  const separator = paneKey.indexOf(':')
  return separator > 0 ? paneKey.slice(0, separator) : null
}

/** The worktree, pane and name of a parent chat the host lists; null when no pane holds it or it has no name. */
export function parentChatOf(
  sessionId: string,
  worktrees: readonly WorktreeAgentRows[]
): (DelegatedChildLocation & { title: string }) | null {
  const tabId = structuredAgentSessionTabId(sessionId)
  for (const worktree of worktrees) {
    const agent = worktree.agents.find((pane) => paneTabIdOfPaneKey(pane.paneKey) === tabId)
    if (agent) {
      return agent.title === undefined
        ? null
        : { worktreeId: worktree.worktreeId, paneKey: agent.paneKey, title: agent.title }
    }
  }
  return null
}

/** The worktree and pane holding a delegated child's structured chat, when the host lists one. */
export function locateStructuredChild(
  childSessionId: string,
  worktrees: readonly WorktreeAgentRows[]
): DelegatedChildLocation | null {
  // Why: a structured chat's pane is keyed under a tab id derived from its session id, so the join needs no new wire field.
  const tabId = structuredAgentSessionTabId(childSessionId)
  for (const worktree of worktrees) {
    const agent = worktree.agents.find((pane) => paneTabIdOfPaneKey(pane.paneKey) === tabId)
    if (agent) {
      return { worktreeId: worktree.worktreeId, paneKey: agent.paneKey }
    }
  }
  return null
}
