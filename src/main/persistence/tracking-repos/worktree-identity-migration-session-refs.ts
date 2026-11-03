import type { TabGroup } from '../../../shared/tab-types'

/**
 * A pane shows a session of another workspace by id, so a reference filed under any workspace's
 * groups names the renamed one. Mutates `groupsByOwner`; returns whether anything changed.
 */
export function repointSessionRefs(
  groupsByOwner: Record<string, TabGroup[]> | undefined,
  oldWorktreeId: string,
  newWorktreeId: string
): boolean {
  if (!groupsByOwner) {
    return false
  }
  let changed = false
  for (const [ownerKey, groups] of Object.entries(groupsByOwner)) {
    if (!groups.some((group) => group.sessionRef?.worktreeId === oldWorktreeId)) {
      continue
    }
    groupsByOwner[ownerKey] = groups.map((group) =>
      group.sessionRef?.worktreeId === oldWorktreeId
        ? { ...group, sessionRef: { ...group.sessionRef, worktreeId: newWorktreeId } }
        : group
    )
    changed = true
  }
  return changed
}
