import { describe, expect, it, vi } from 'vitest'
import type { RpcResponse } from '../transport/types'
import { initFolderRepoGit } from './folder-repo-git-init'

function fakeClient(reply: () => Promise<RpcResponse>) {
  const sendRequest = vi.fn(reply)
  return { client: { sendRequest }, sendRequest }
}

const ok = (result: unknown): RpcResponse => ({ id: '1', ok: true, result })

describe('initFolderRepoGit', () => {
  it('sends repo.initGit with the repo selector and reports success', async () => {
    const { client, sendRequest } = fakeClient(async () => ok({ ok: true, repo: { id: 'repo-1' } }))
    await expect(initFolderRepoGit(client, 'repo-1')).resolves.toEqual({ ok: true })
    expect(sendRequest).toHaveBeenCalledWith('repo.initGit', { repo: 'repo-1' })
  })

  it('prefers git text over the error code when the host refuses', async () => {
    const { client } = fakeClient(async () =>
      ok({ ok: false, error: 'git_init_failed', message: 'fatal: cannot lock index' })
    )
    await expect(initFolderRepoGit(client, 'repo-1')).resolves.toEqual({
      ok: false,
      message: 'fatal: cannot lock index'
    })
  })

  it('falls back to the error code when the refusal has no message', async () => {
    const { client } = fakeClient(async () => ok({ ok: false, error: 'has_folder_workspaces' }))
    await expect(initFolderRepoGit(client, 'repo-1')).resolves.toEqual({
      ok: false,
      message: 'has_folder_workspaces'
    })
  })

  it('reports an RPC-level refusal with the host message', async () => {
    const { client } = fakeClient(async () => ({
      id: '1',
      ok: false,
      error: { code: 'repo_not_found', message: 'No such repo' }
    }))
    await expect(initFolderRepoGit(client, 'repo-1')).resolves.toEqual({
      ok: false,
      message: 'No such repo'
    })
  })

  it('reports a transport failure instead of throwing', async () => {
    const { client } = fakeClient(async () => {
      throw new Error('socket closed')
    })
    await expect(initFolderRepoGit(client, 'repo-1')).resolves.toEqual({
      ok: false,
      message: 'socket closed'
    })
  })
})
