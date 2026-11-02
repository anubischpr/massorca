import { describe, expect, it } from 'vitest'
import type { ConnectionState } from '../transport/types'
import { canDeleteFromWorktreeSheet, isHostRowUnreachable } from './worktree-row-policy'

describe('isHostRowUnreachable', () => {
  it.each<[ConnectionState, boolean]>([
    ['connected', false],
    ['connecting', false],
    ['handshaking', false],
    ['reconnecting', true],
    ['disconnected', true],
    ['auth-failed', true]
  ])('reads a %s host as unreachable: %s', (state, unreachable) => {
    expect(isHostRowUnreachable(state)).toBe(unreachable)
  })
})

describe('canDeleteFromWorktreeSheet', () => {
  it('offers Delete for a git worktree', () => {
    expect(canDeleteFromWorktreeSheet({ workspaceKind: 'git' })).toBe(true)
    expect(canDeleteFromWorktreeSheet({})).toBe(true)
  })

  it('leaves Delete out of a folder workspace sheet', () => {
    expect(canDeleteFromWorktreeSheet({ workspaceKind: 'folder-workspace' })).toBe(false)
  })
})
