import { resolveAgentRowParentPaneKey } from '@/components/dashboard/agent-row-lineage-model'
import type { buildPaneKeyByTerminalHandle } from '@/components/dashboard/agent-row-lineage-model'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

type SessionRecord = { paneKey: string; entry: AgentStatusEntry; ownWorktreeId: string }

/**
 * The worktrees of the sessions each worktree's sessions are parents of, one level down. A child in
 * its parent's own worktree adds nothing: it is not a worktree of its own to delete.
 */
export function childSessionWorktreesOf<T extends SessionRecord>(
  records: ReadonlyMap<string, T>,
  paneKeyByTerminalHandle: ReturnType<typeof buildPaneKeyByTerminalHandle>
): Map<string, string[]> {
  const childWorktrees = new Map<string, Set<string>>()
  for (const record of records.values()) {
    const parentPaneKey = resolveAgentRowParentPaneKey(record, records, paneKeyByTerminalHandle)
    const parent = parentPaneKey === undefined ? undefined : records.get(parentPaneKey)
    if (parent && parent.ownWorktreeId !== record.ownWorktreeId) {
      const children = childWorktrees.get(parent.ownWorktreeId) ?? new Set<string>()
      children.add(record.ownWorktreeId)
      childWorktrees.set(parent.ownWorktreeId, children)
    }
  }
  return new Map([...childWorktrees].map(([worktreeId, children]) => [worktreeId, [...children]]))
}
