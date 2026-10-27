// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyRepositoryGhAccountGitConfig,
  readRepositoryGhAccountGitConfig
} from '@/components/settings/repository-github-account'
import {
  clearRepoGhAccountGitConfigCache,
  invalidateRepoGhAccountGitConfig
} from '@/lib/repo-gh-account-git-config-cache'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import type { Repo } from '../../../../shared/repo-types'
import { deriveRepoGhAccountDisplay, useRepoGhAccountDisplay } from './use-repo-gh-account-display'

vi.mock('@/components/settings/repository-github-account', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readRepositoryGhAccountGitConfig: vi.fn()
}))

const readGitConfig = vi.mocked(readRepositoryGhAccountGitConfig)
const initialState = useAppStore.getInitialState()

function makeRepo(overrides: Partial<Repo> & { id: string }): Repo {
  return {
    path: `/repos/${overrides.id}`,
    displayName: overrides.id,
    badgeColor: '#000',
    addedAt: 1,
    executionHostId: 'local',
    ...overrides
  }
}

/** Lets queued git config reads settle and React apply their updates. */
async function settleReads(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  useAppStore.setState({ ...initialState, settings: getDefaultSettings('/home/tester') }, true)
  clearRepoGhAccountGitConfigCache()
  readGitConfig.mockReset()
  readGitConfig.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
})

describe('deriveRepoGhAccountDisplay', () => {
  it('shows the git config login exactly and flags a different Orca binding', () => {
    expect(
      deriveRepoGhAccountDisplay({ host: 'github.com', user: 'palominoc' }, 'palominoc-perulaunch')
    ).toEqual({ label: 'palominoc-perulaunch', source: 'git-config', mismatch: true })
  })

  it('compares logins case-sensitively', () => {
    expect(
      deriveRepoGhAccountDisplay({ host: 'github.com', user: 'palominoc' }, 'PalominoC')
    ).toEqual({ label: 'PalominoC', source: 'git-config', mismatch: true })
  })

  it('uses the Orca binding when gh.account is unset', () => {
    expect(
      deriveRepoGhAccountDisplay({ host: 'github.acme.com', user: 'svc_build' }, null)
    ).toEqual({ label: 'svc_build@github.acme.com', source: 'orca-binding', mismatch: false })
  })

  it('does not flag a mismatch when gh.account matches the binding', () => {
    expect(deriveRepoGhAccountDisplay({ host: 'github.com', user: 'alice' }, 'alice')).toEqual({
      label: 'alice',
      source: 'git-config',
      mismatch: false
    })
  })

  it('shows a git config pin without a binding to compare against', () => {
    expect(deriveRepoGhAccountDisplay(null, 'alice')).toEqual({
      label: 'alice',
      source: 'git-config',
      mismatch: false
    })
  })

  it('shows nothing when neither is set', () => {
    expect(deriveRepoGhAccountDisplay(undefined, null)).toEqual({
      label: null,
      source: null,
      mismatch: false
    })
  })
})

describe('useRepoGhAccountDisplay', () => {
  it('prefers gh.account from git config over the Orca binding', async () => {
    readGitConfig.mockResolvedValue({ account: 'palominoc-perulaunch', identityManaged: false })
    const repo = makeRepo({ id: 'repo-a', ghAccount: { host: 'github.com', user: 'palominoc' } })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await waitFor(() => expect(result.current.source).toBe('git-config'))
    expect(result.current).toEqual({
      label: 'palominoc-perulaunch',
      source: 'git-config',
      mismatch: true
    })
    expect(readGitConfig).toHaveBeenCalledWith(
      { kind: 'local' },
      { id: 'repo-a', path: '/repos/repo-a' }
    )
  })

  it('falls back to the Orca binding when gh.account is unset', async () => {
    readGitConfig.mockResolvedValue({ account: null, identityManaged: false })
    const repo = makeRepo({
      id: 'repo-b',
      ghAccount: { host: 'github.acme.com', user: 'svc_build' }
    })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await settleReads()
    expect(readGitConfig).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({
      label: 'svc_build@github.acme.com',
      source: 'orca-binding',
      mismatch: false
    })
  })

  it('falls back to the Orca binding when the read throws, as on runtimes without the RPC', async () => {
    readGitConfig.mockRejectedValue(new Error('unknown method'))
    const repo = makeRepo({ id: 'repo-c', ghAccount: { host: 'github.com', user: 'alice' } })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await settleReads()
    expect(result.current).toEqual({ label: 'alice', source: 'orca-binding', mismatch: false })
  })

  it('falls back to the Orca binding when the host returns no reading', async () => {
    readGitConfig.mockResolvedValue(null)
    const repo = makeRepo({ id: 'repo-d', ghAccount: { host: 'github.com', user: 'alice' } })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await settleReads()
    expect(result.current).toEqual({ label: 'alice', source: 'orca-binding', mismatch: false })
  })

  it('skips the git config read for folder workspaces', async () => {
    const repo = makeRepo({
      id: 'folder-a',
      kind: 'folder',
      ghAccount: { host: 'github.com', user: 'alice' }
    })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await settleReads()
    expect(readGitConfig).not.toHaveBeenCalled()
    expect(result.current).toEqual({ label: 'alice', source: 'orca-binding', mismatch: false })
  })

  it('returns nothing and reads nothing without a repo', async () => {
    const { result } = renderHook(() => useRepoGhAccountDisplay(undefined))
    await settleReads()
    expect(readGitConfig).not.toHaveBeenCalled()
    expect(result.current).toEqual({ label: null, source: null, mismatch: false })
  })

  it('shares one in-flight read across rows and keeps the reading cached afterwards', async () => {
    let finish: (value: { account: string; identityManaged: boolean }) => void = () => undefined
    readGitConfig.mockReturnValue(
      new Promise<{ account: string; identityManaged: boolean }>((resolve) => {
        finish = resolve
      })
    )
    const repo = makeRepo({ id: 'repo-e', ghAccount: { host: 'github.com', user: 'alice' } })
    const first = renderHook(() => useRepoGhAccountDisplay(repo))
    const second = renderHook(() => useRepoGhAccountDisplay(repo))
    first.rerender()
    expect(readGitConfig).toHaveBeenCalledTimes(1)
    await act(async () => {
      finish({ account: 'alice-work', identityManaged: false })
    })
    await waitFor(() => expect(second.result.current.label).toBe('alice-work'))
    expect(first.result.current.label).toBe('alice-work')
    second.rerender()
    expect(readGitConfig).toHaveBeenCalledTimes(1)
  })

  it('re-reads when the Orca binding changes', async () => {
    readGitConfig.mockResolvedValueOnce({ account: 'alice', identityManaged: false })
    readGitConfig.mockResolvedValueOnce({ account: 'bob', identityManaged: false })
    const { result, rerender } = renderHook(({ repo }) => useRepoGhAccountDisplay(repo), {
      initialProps: {
        repo: makeRepo({ id: 'repo-f', ghAccount: { host: 'github.com', user: 'alice' } })
      }
    })
    await waitFor(() => expect(result.current.label).toBe('alice'))
    rerender({ repo: makeRepo({ id: 'repo-f', ghAccount: { host: 'github.com', user: 'bob' } }) })
    await waitFor(() => expect(result.current.label).toBe('bob'))
    expect(readGitConfig).toHaveBeenCalledTimes(2)
  })

  it('re-reads after the git config write is invalidated', async () => {
    readGitConfig.mockResolvedValueOnce({ account: 'alice', identityManaged: false })
    readGitConfig.mockResolvedValueOnce({ account: 'alice-work', identityManaged: false })
    const repo = makeRepo({ id: 'repo-g', ghAccount: { host: 'github.com', user: 'alice' } })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await waitFor(() => expect(result.current.label).toBe('alice'))
    act(() => {
      invalidateRepoGhAccountGitConfig('repo-g')
    })
    await waitFor(() => expect(result.current.label).toBe('alice-work'))
    expect(readGitConfig).toHaveBeenCalledTimes(2)
  })

  it('shows the value a settled write leaves in git config', async () => {
    readGitConfig.mockResolvedValueOnce({ account: 'alice', identityManaged: false })
    readGitConfig.mockResolvedValueOnce({ account: 'bob', identityManaged: false })
    const applyAccountGitConfig = vi.fn(async () => ({ ok: true, identity: 'not_requested' }))
    Object.assign(window, { api: { gh: { applyAccountGitConfig } } })
    const repo = makeRepo({ id: 'repo-h', ghAccount: { host: 'github.com', user: 'alice' } })
    const { result } = renderHook(() => useRepoGhAccountDisplay(repo))
    await waitFor(() => expect(result.current.label).toBe('alice'))
    await act(async () => {
      await applyRepositoryGhAccountGitConfig({ kind: 'local' }, repo, {
        next: { host: 'github.com', user: 'bob' },
        previous: { host: 'github.com', user: 'alice' },
        setIdentity: false
      })
    })
    expect(applyAccountGitConfig).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.label).toBe('bob'))
  })

  it('retries a failed read the next time a row mounts', async () => {
    readGitConfig.mockRejectedValueOnce(new Error('connection not ready'))
    readGitConfig.mockResolvedValueOnce({ account: 'alice-work', identityManaged: false })
    const repo = makeRepo({ id: 'repo-i', ghAccount: { host: 'github.com', user: 'alice' } })
    const first = renderHook(() => useRepoGhAccountDisplay(repo))
    await settleReads()
    first.unmount()
    const second = renderHook(() => useRepoGhAccountDisplay(repo))
    await waitFor(() => expect(second.result.current.label).toBe('alice-work'))
    expect(readGitConfig).toHaveBeenCalledTimes(2)
  })

  it('ignores a read that settles after its row unmounted', async () => {
    let finish: (value: { account: string; identityManaged: boolean }) => void = () => undefined
    readGitConfig.mockReturnValue(
      new Promise<{ account: string; identityManaged: boolean }>((resolve) => {
        finish = resolve
      })
    )
    const repo = makeRepo({ id: 'repo-j', ghAccount: { host: 'github.com', user: 'alice' } })
    const { unmount } = renderHook(() => useRepoGhAccountDisplay(repo))
    unmount()
    await act(async () => {
      finish({ account: 'alice-work', identityManaged: false })
    })
    expect(readGitConfig).toHaveBeenCalledTimes(1)
  })
})
