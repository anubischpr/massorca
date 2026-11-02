import type { TabGroupLayoutNode } from '../../../../shared/tab-types'

/** Drops leaves whose group is gone, and repeat leaves for a group already
 *  placed earlier in the tree — one column per group is the render invariant,
 *  and a repeated leaf paints the same tab strip in every one of its columns. */
export function pruneTabGroupLayoutForGroups(
  root: TabGroupLayoutNode,
  validGroupIds: Set<string>
): TabGroupLayoutNode | null {
  return pruneLayoutNodeForGroups(root, validGroupIds, new Set())
}

function pruneLayoutNodeForGroups(
  root: TabGroupLayoutNode,
  validGroupIds: Set<string>,
  placedGroupIds: Set<string>
): TabGroupLayoutNode | null {
  if (root.type === 'leaf') {
    if (!validGroupIds.has(root.groupId) || placedGroupIds.has(root.groupId)) {
      return null
    }
    placedGroupIds.add(root.groupId)
    return root
  }

  const first = pruneLayoutNodeForGroups(root.first, validGroupIds, placedGroupIds)
  const second = pruneLayoutNodeForGroups(root.second, validGroupIds, placedGroupIds)

  if (first === null) {
    return second
  }
  if (second === null) {
    return first
  }
  if (first === root.first && second === root.second) {
    return root
  }

  return { ...root, first, second }
}
