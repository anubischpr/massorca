// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAddRepoGhAccount } from './use-add-repo-gh-account'

const { storeState, applyGitConfigMock, toastInfo, toastError } = vi.hoisted(() => ({
  storeState: {
    repos: [{ id: 'repo-1', path: '/p', displayName: 'api' }],
    updateRepo: vi.fn(async () => true)
  },
  applyGitConfigMock: vi.fn(async () => ({ ok: true, identity: 'not_requested' })),
  toastInfo: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => storeState } }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: toastInfo, error: toastError } }))
vi.mock('../settings/repository-github-account', () => ({
  applyRepositoryGhAccountGitConfig: applyGitConfigMock
}))

const gh = {
  listHostBindableAccounts: vi.fn(),
  listAccountOrgs: vi.fn(),
  inferRepoAccount: vi.fn()
}

const keyring = (user: string) => ({
  host: 'github.com',
  user,
  active: false,
  envToken: null,
  source: 'keyring',
  scopes: []
})

beforeEach(() => {
  vi.stubGlobal('window', Object.assign(window, { api: { gh } }))
  gh.listHostBindableAccounts.mockResolvedValue({
    capability: 'supported',
    accounts: [keyring('palominoc'), keyring('palominoc-perulaunch')]
  })
  gh.listAccountOrgs.mockResolvedValue({ 'github.com\0palominoc-perulaunch': ['Alterra-DS'] })
  storeState.updateRepo.mockClear()
  applyGitConfigMock.mockClear()
  toastInfo.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

async function renderOpen() {
  const hook = renderHook(() => useAddRepoGhAccount(true, null))
  await waitFor(() => expect(hook.result.current.accounts).toHaveLength(2))
  return hook
}

describe('useAddRepoGhAccount', () => {
  it('resolves a clone account by owner login, then by single org membership', async () => {
    const { result } = await renderOpen()
    await expect(
      result.current.resolveForCloneUrl('https://github.com/palominoc/x')
    ).resolves.toEqual({ host: 'github.com', user: 'palominoc' })
    expect(gh.listAccountOrgs).not.toHaveBeenCalled()
    await expect(
      result.current.resolveForCloneUrl('https://github.com/Alterra-DS/api')
    ).resolves.toEqual({ host: 'github.com', user: 'palominoc-perulaunch' })
  })

  it('clones with the ambient login when None is picked', async () => {
    const { result } = await renderOpen()
    act(() => result.current.setChoice('none'))
    await expect(
      result.current.resolveForCloneUrl('https://github.com/palominoc/x')
    ).resolves.toBeNull()
  })

  it('binds the added repo from the inferred account', async () => {
    gh.inferRepoAccount.mockResolvedValue({
      inference: { binding: { host: 'github.com', user: 'palominoc' }, reason: 'owner_login' },
      remoteOwner: 'palominoc'
    })
    const { result } = await renderOpen()
    await act(() => result.current.applyAfterAdd('repo-1', 'local'))
    expect(storeState.updateRepo).toHaveBeenCalledWith(
      'repo-1',
      { ghAccount: { host: 'github.com', user: 'palominoc' } },
      { hostId: 'local' }
    )
    expect(applyGitConfigMock).toHaveBeenCalledWith(
      { kind: 'local' },
      expect.objectContaining({ id: 'repo-1' }),
      { next: { host: 'github.com', user: 'palominoc' }, previous: null, setIdentity: false }
    )
  })

  it('asks instead of binding when the remote is ambiguous', async () => {
    gh.inferRepoAccount.mockResolvedValue({ inference: null, remoteOwner: 'Alterra-DS' })
    const { result } = await renderOpen()
    await act(() => result.current.applyAfterAdd('repo-1', 'local'))
    expect(storeState.updateRepo).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })
})
