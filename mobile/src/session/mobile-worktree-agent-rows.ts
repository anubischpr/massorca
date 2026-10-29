import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { DelegatedChildLocation } from './mobile-delegated-child-access'

/** One agent pane a worktree lists, and the pane key of the pane that spawned it. */
export type WorktreeAgentPane = { paneKey: string; parentPaneKey: string | null }

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
        agents.push({
          paneKey: agent.paneKey,
          parentPaneKey: typeof agent.parentPaneKey === 'string' ? agent.parentPaneKey : null
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
