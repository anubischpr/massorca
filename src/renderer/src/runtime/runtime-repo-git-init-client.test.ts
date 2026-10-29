// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { REPO_INIT_GIT_RUNTIME_CAPABILITY } from '../../../shared/protocol-version'

const { callRuntimeRpc, runtimeEnvironmentSupportsCapability } = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  runtimeEnvironmentSupportsCapability: vi.fn()
}))

vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc, runtimeEnvironmentSupportsCapability }))

import {
  initializeRuntimeRepoGit,
  runtimeRepoSupportsGitInit
} from './runtime-repo-git-init-client'

beforeEach(() => {
  callRuntimeRpc.mockReset()
  runtimeEnvironmentSupportsCapability.mockReset()
})

describe('runtimeRepoSupportsGitInit', () => {
  it('is available for this machine, including its SSH repos, without probing a host', async () => {
    await expect(runtimeRepoSupportsGitInit(null)).resolves.toBe(true)
    await expect(runtimeRepoSupportsGitInit(null, 'ssh:target-1')).resolves.toBe(true)
    expect(runtimeEnvironmentSupportsCapability).not.toHaveBeenCalled()
  })

  it('follows the capability a paired host advertises', async () => {
    runtimeEnvironmentSupportsCapability.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const settings = { activeRuntimeEnvironmentId: 'env-1' }

    await expect(runtimeRepoSupportsGitInit(settings)).resolves.toBe(true)
    await expect(runtimeRepoSupportsGitInit(settings)).resolves.toBe(false)
    expect(runtimeEnvironmentSupportsCapability).toHaveBeenCalledWith(
      'env-1',
      REPO_INIT_GIT_RUNTIME_CAPABILITY
    )
  })

  it('hides the action instead of failing when the host cannot be reached', async () => {
    runtimeEnvironmentSupportsCapability.mockRejectedValue(new Error('offline'))

    await expect(runtimeRepoSupportsGitInit(null, 'runtime:env-2')).resolves.toBe(false)
    expect(runtimeEnvironmentSupportsCapability).toHaveBeenCalledWith(
      'env-2',
      REPO_INIT_GIT_RUNTIME_CAPABILITY
    )
  })
})

describe('initializeRuntimeRepoGit', () => {
  it('asks the runtime host that owns the repo, whatever environment is active', async () => {
    callRuntimeRpc.mockResolvedValue({ ok: false, error: 'has_folder_workspaces' })

    const result = await initializeRuntimeRepoGit(
      { activeRuntimeEnvironmentId: 'env-active' },
      'repo-1',
      'runtime:env-owner'
    )

    expect(result).toEqual({ ok: false, error: 'has_folder_workspaces' })
    expect(callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-owner' },
      'repo.initGit',
      { repo: 'repo-1' },
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    )
  })

  it('uses this machine runtime for local and SSH repos', async () => {
    callRuntimeRpc.mockResolvedValue({ ok: true })

    await initializeRuntimeRepoGit({ activeRuntimeEnvironmentId: 'env-active' }, 'repo-1', 'ssh:t1')
    await initializeRuntimeRepoGit(null, 'repo-2')

    expect(callRuntimeRpc.mock.calls.map(([target]) => target)).toEqual([
      { kind: 'local' },
      { kind: 'local' }
    ])
  })
})
