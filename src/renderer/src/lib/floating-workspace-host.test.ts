import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTestStore,
  makeRuntimeOwnedWorktree,
  seedStore
} from '../store/slices/store-test-helpers'
import {
  FLOATING_HOST_NO_WORKSPACE_REASON,
  FLOATING_HOST_THIS_COMPUTER,
  resolveFloatingWorkspaceHost,
  selectFloatingHostCreationTarget
} from './floating-workspace-host'

const VPS_A = 'env-vps-a'
const VPS_B = 'env-vps-b'
const PAIRED = [VPS_A, VPS_B]

describe('resolveFloatingWorkspaceHost', () => {
  it('defaults to the focused workspace host, then the last used host, then this computer', () => {
    const base = { chosen: null, pairedHostIds: PAIRED }

    expect(resolveFloatingWorkspaceHost({ ...base, focusedHost: VPS_B, lastUsedHost: VPS_A })).toBe(
      VPS_B
    )
    expect(resolveFloatingWorkspaceHost({ ...base, focusedHost: null, lastUsedHost: VPS_A })).toBe(
      VPS_A
    )
    expect(resolveFloatingWorkspaceHost({ ...base, focusedHost: null, lastUsedHost: null })).toBe(
      FLOATING_HOST_THIS_COMPUTER
    )
  })

  it('keeps this computer when the focused workspace is local, whatever was used last', () => {
    expect(
      resolveFloatingWorkspaceHost({
        chosen: null,
        focusedHost: FLOATING_HOST_THIS_COMPUTER,
        lastUsedHost: VPS_A,
        pairedHostIds: PAIRED
      })
    ).toBe(FLOATING_HOST_THIS_COMPUTER)
  })

  it('skips a remembered host that is no longer paired', () => {
    expect(
      resolveFloatingWorkspaceHost({
        chosen: null,
        focusedHost: null,
        lastUsedHost: 'env-removed',
        pairedHostIds: PAIRED
      })
    ).toBe(FLOATING_HOST_THIS_COMPUTER)
  })

  it('keeps the host the person picked over the defaults', () => {
    expect(
      resolveFloatingWorkspaceHost({
        chosen: VPS_A,
        focusedHost: VPS_B,
        lastUsedHost: null,
        pairedHostIds: PAIRED
      })
    ).toBe(VPS_A)
  })
})

describe('selectFloatingHostCreationTarget', () => {
  const store = createTestStore()

  beforeEach(() => {
    seedStore(store, {
      activeWorktreeId: 'repo-a::/srv/focused',
      worktreesByRepo: {
        'repo-a': [
          makeRuntimeOwnedWorktree(
            { id: 'repo-a::/srv/focused', repoId: 'repo-a', lastActivityAt: 10 },
            VPS_A
          ),
          makeRuntimeOwnedWorktree(
            { id: 'repo-a::/srv/older', repoId: 'repo-a', lastActivityAt: 40 },
            VPS_B
          ),
          makeRuntimeOwnedWorktree(
            { id: 'repo-a::/srv/recent', repoId: 'repo-a', lastActivityAt: 90 },
            VPS_B
          )
        ]
      }
    })
  })

  it('creates on the focused workspace when it is on the selected host', () => {
    expect(selectFloatingHostCreationTarget(store.getState(), VPS_A)).toEqual({
      kind: 'workspace',
      worktreeId: 'repo-a::/srv/focused',
      environmentId: VPS_A
    })
  })

  it('falls back to the most recently used workspace on that host', () => {
    expect(selectFloatingHostCreationTarget(store.getState(), VPS_B)).toEqual({
      kind: 'workspace',
      worktreeId: 'repo-a::/srv/recent',
      environmentId: VPS_B
    })
  })

  it('reports the reason when the selected host has no workspace', () => {
    expect(selectFloatingHostCreationTarget(store.getState(), 'env-empty')).toEqual({
      kind: 'unavailable',
      reason: FLOATING_HOST_NO_WORKSPACE_REASON
    })
  })

  it('keeps This computer on the floating workspace itself', () => {
    expect(selectFloatingHostCreationTarget(store.getState(), FLOATING_HOST_THIS_COMPUTER)).toEqual(
      { kind: 'floating' }
    )
  })
})
