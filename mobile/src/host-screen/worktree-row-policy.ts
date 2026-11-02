import type { ConnectionState } from '../transport/types'

/**
 * Whether a host's rows read as unreachable: dimmed, with their sessions unconfirmed and the chip.
 * A host that is still connecting or handshaking has not failed, so its rows read normally.
 */
export function isHostRowUnreachable(state: ConnectionState): boolean {
  return state !== 'connected' && state !== 'connecting' && state !== 'handshaking'
}

/**
 * Whether a worktree's sheet offers Delete. Delete removes a git worktree's checkout; a folder
 * workspace has no folder-only removal the phone may call, so its sheet leaves Delete out.
 */
export function canDeleteFromWorktreeSheet(item: {
  workspaceKind?: 'git' | 'folder-workspace'
}): boolean {
  return item.workspaceKind !== 'folder-workspace'
}
