import { defaultRangeExtractor } from '@tanstack/react-virtual'
import type { Range } from '@tanstack/react-virtual'
import {
  getActiveStickyHeaderIndex,
  getPreviousStickyHeaderIndex
} from '../sidebar/worktree-list/viewport/virtual-rows'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import type { AiVaultListRow } from './AiVaultVirtualRow'
import type { AiVaultSessionListGroup } from './ai-vault-session-filters'

export const VAULT_GROUP_HEADER_ROW_HEIGHT = 32
export const VAULT_SESSION_ROW_HEIGHT = 98
export const VAULT_NESTED_SESSION_ROW_HEIGHT = 58

export type VaultVirtualRow = { type: 'group' | 'session' }

/** Each root session row, with its delegated children right after it, under the group's header. */
export function buildAiVaultVirtualRows(args: {
  groups: readonly AiVaultSessionListGroup[]
  collapsedGroups: ReadonlySet<string>
  delegatedChildrenByRootId: ReadonlyMap<string, readonly AiVaultSession[]>
}): AiVaultListRow[] {
  const rows: AiVaultListRow[] = []
  for (const sessionGroup of args.groups) {
    const label = sessionGroup.label
    if (label !== null) {
      rows.push({ type: 'group', group: { ...sessionGroup, label } })
    }
    if (label === null || !args.collapsedGroups.has(sessionGroup.key)) {
      for (const session of sessionGroup.sessions) {
        rows.push({ type: 'session', groupKey: sessionGroup.key, session })
        for (const child of args.delegatedChildrenByRootId.get(session.id) ?? []) {
          rows.push({
            type: 'session',
            groupKey: sessionGroup.key,
            session: child,
            nestedChild: true
          })
        }
      }
    }
  }
  return rows
}

export function getVaultStickyHeaderIndexes(rows: readonly VaultVirtualRow[]): number[] {
  const indexes: number[] = []
  rows.forEach((row, index) => {
    if (row.type === 'group') {
      indexes.push(index)
    }
  })
  return indexes
}

export function extractVaultVirtualRowIndexes(args: {
  range: Range
  stickyHeaderIndexes: readonly number[]
}): number[] {
  const activeStickyHeaderIndex = getActiveStickyHeaderIndex(
    args.stickyHeaderIndexes,
    args.range.startIndex
  )
  if (activeStickyHeaderIndex === null) {
    return defaultRangeExtractor(args.range)
  }

  const previousStickyHeaderIndex = getPreviousStickyHeaderIndex(
    args.stickyHeaderIndexes,
    activeStickyHeaderIndex
  )
  return Array.from(
    new Set([
      activeStickyHeaderIndex,
      ...(previousStickyHeaderIndex === null ? [] : [previousStickyHeaderIndex]),
      ...defaultRangeExtractor(args.range)
    ])
  ).sort((a, b) => a - b)
}
