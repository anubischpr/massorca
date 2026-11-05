import { describe, expect, it } from 'vitest'
import { getFileExplorerOperationOwnerForHost } from './file-explorer-operation-owner'

type OwnerState = Parameters<typeof getFileExplorerOperationOwnerForHost>[0]

const worktreeId = 'repo-1::C:\\code\\app'

/** A client paired with one VPS runtime, holding a local repo whose worktree row is not loaded yet. */
function pairedClientState(): OwnerState {
  const state = {
    settings: { activeRuntimeEnvironmentId: 'vps' },
    runtimeEnvironments: [{ id: 'vps' }],
    repos: [{ id: 'repo-1', path: 'C:\\code\\app', kind: 'git', hostId: 'local' }],
    worktreesByRepo: {},
    detectedWorktreesByRepo: {},
    folderWorkspaces: [],
    projectGroups: [],
    restoredRuntimeHostIdByWorkspaceSessionKey: {},
    sshConnectionStates: new Map(),
    activeWorktreeId: null,
    activeWorkspaceExecutionHostId: null
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads only the fields above.
  return state as unknown as OwnerState
}

const local = { executionHostId: 'local' as const, rootPath: 'C:\\code\\app' }

describe('getFileExplorerOperationOwnerForHost', () => {
  it('lists a local worktree on this computer when the local host is picked, even while a VPS is paired', () => {
    const state = pairedClientState()
    expect(getFileExplorerOperationOwnerForHost(state, worktreeId, undefined)).toEqual({
      kind: 'runtime',
      environmentId: 'vps',
      executionHostId: 'runtime:vps'
    })
    expect(getFileExplorerOperationOwnerForHost(state, worktreeId, local)).toEqual({
      kind: 'local'
    })
  })

  it('keeps a picked VPS host on that runtime', () => {
    expect(
      getFileExplorerOperationOwnerForHost(pairedClientState(), worktreeId, {
        executionHostId: 'runtime:vps',
        rootPath: null
      })
    ).toEqual({ kind: 'runtime', environmentId: 'vps', executionHostId: 'runtime:vps' })
  })
})
