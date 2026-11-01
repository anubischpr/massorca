import { describe, expect, it, vi } from 'vitest'
import { hookMount } from '../test-support/rpc-recording/hook-mount'
import { FakeSession } from '../transport/mobile-endpoint-supervisor-test-fakes'
import type { RpcResponse } from '../transport/types'
import { useHostRepoMetadata } from './use-host-repo-metadata'

vi.mock('../worktree/repo-git-account-read', () => ({ watchRepoGitAccounts: () => {} }))

type Repo = { id: string; displayName: string; kind?: string }
const reply = (repos: Repo[]): RpcResponse => ({ id: 'r', ok: true, result: { repos } })

// Mounts the hook over a fake session and records every folder set it publishes.
function mountMetadata(client: FakeSession) {
  const folderSets: string[][] = []
  // The other setters paint rows this test does not read, so they are inert.
  const state = new Proxy<Record<string, unknown>>(
    {
      clientRef: { current: client },
      fetchRepoMetadataInFlightRef: { current: new Set() },
      fetchRepoMetadataPendingRef: { current: new Set() },
      repoMetadataFetchedAtRef: { current: 0 },
      setFolderRepoIds: (ids: Set<string>) => folderSets.push([...ids])
    },
    { get: (target, key) => (typeof key === 'string' && key in target ? target[key] : () => {}) }
  )
  let refresh!: (options?: { force?: boolean }) => Promise<void>
  const mount = hookMount(() => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the state members it names.
    refresh = useHostRepoMetadata({
      client,
      connState: 'connected',
      hostId: 'host-1',
      state: state as never
    })
  })
  mount.mount()
  return { folderSets, refresh: () => refresh({ force: true }) }
}

describe('useHostRepoMetadata folder set', () => {
  it('publishes only the folder repo ids as the No Git set', async () => {
    const client = new FakeSession('connected')
    client.sendRequest.mockResolvedValue(
      reply([
        { id: 'repo-folder', displayName: 'notes', kind: 'folder' },
        { id: 'repo-git', displayName: 'orca', kind: 'git' },
        { id: 'repo-legacy', displayName: 'old' }
      ])
    )
    const { folderSets, refresh } = mountMetadata(client)
    await refresh()
    expect(folderSets).toEqual([['repo-folder']])
  })

  it('drops a repo from the No Git set once a re-fetch reports it as git', async () => {
    const client = new FakeSession('connected')
    client.sendRequest
      .mockResolvedValueOnce(reply([{ id: 'repo-1', displayName: 'notes', kind: 'folder' }]))
      .mockResolvedValueOnce(reply([{ id: 'repo-1', displayName: 'notes', kind: 'git' }]))
    const { folderSets, refresh } = mountMetadata(client)
    await refresh()
    await refresh()
    expect(folderSets).toEqual([['repo-1'], []])
  })
})
