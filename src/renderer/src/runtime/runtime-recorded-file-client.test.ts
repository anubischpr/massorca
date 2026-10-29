import { describe, expect, it } from 'vitest'
import {
  isMissingRuntimePathError,
  readRuntimeFilePreview,
  statRuntimePath
} from './runtime-file-client'
import {
  isOutsideRemoteWorkspaceError,
  RecordedFileHostOutdatedError,
  RecordedFileRefusedError
} from './runtime-recorded-file-client'
import { RemoteFileOutsideWorktreeError } from './runtime-file-routing'
import {
  fsReadFile,
  fsStat,
  installRuntimeFileClientEnvironment,
  runtimeEnvironmentCall
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

const OUTSIDE = '/home/me/informes/report.html'
const chat = {
  settings: { activeRuntimeEnvironmentId: 'env-1' },
  worktreeId: 'wt-1',
  worktreePath: '/remote/repo',
  agentSessionId: 'session-alpha'
}

function answer(result: unknown): void {
  runtimeEnvironmentCall.mockResolvedValueOnce({
    id: 'rpc-1',
    ok: true,
    result,
    _meta: { runtimeId: 'remote-runtime' }
  })
}

describe('a chat file outside a paired host worktree', () => {
  it('stats through the recorded-file RPC, not the worktree one', async () => {
    answer({ ok: true, mode: 'stat', size: 12, isDirectory: false, mtime: 7 })

    await expect(statRuntimePath(chat, OUTSIDE)).resolves.toEqual({
      size: 12,
      isDirectory: false,
      mtime: 7
    })
    expect(runtimeEnvironmentCall).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentCall).toHaveBeenCalledWith({
      selector: 'env-1',
      method: 'agentSession.readRecordedFile',
      params: { sessionId: 'session-alpha', path: OUTSIDE, mode: 'stat' },
      timeoutMs: 15_000
    })
    expect(fsStat).not.toHaveBeenCalled()
  })

  it('previews through the recorded-file RPC and drops the envelope fields', async () => {
    answer({ ok: true, mode: 'preview', content: '<h1>Hi</h1>', isBinary: false })

    await expect(readRuntimeFilePreview(chat, OUTSIDE)).resolves.toEqual({
      content: '<h1>Hi</h1>',
      isBinary: false
    })
    expect(runtimeEnvironmentCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'agentSession.readRecordedFile',
        params: { sessionId: 'session-alpha', path: OUTSIDE, mode: 'preview' }
      })
    )
    expect(fsReadFile).not.toHaveBeenCalled()
  })

  it('keeps reading inside the worktree through the worktree RPCs', async () => {
    answer({ size: 3, isDirectory: false, mtime: 1 })

    await statRuntimePath(chat, '/remote/repo/src/index.ts')

    expect(runtimeEnvironmentCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'files.stat',
        params: { worktree: 'id:wt-1', relativePath: 'src/index.ts' }
      })
    )
  })

  it('refuses without a chat, as before, and never asks the host', async () => {
    const { agentSessionId: _chat, ...withoutChat } = chat

    const stat = await statRuntimePath(withoutChat, OUTSIDE).catch((error: unknown) => error)
    const preview = await readRuntimeFilePreview(withoutChat, OUTSIDE).catch(
      (error: unknown) => error
    )

    for (const error of [stat, preview]) {
      expect(error).toBeInstanceOf(RemoteFileOutsideWorktreeError)
      expect(error).toHaveProperty('message', 'Remote file is outside the owning runtime worktree')
      expect(isOutsideRemoteWorkspaceError(error)).toBe(true)
    }
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('leaves SSH and local paths out of it', async () => {
    fsStat.mockResolvedValue({ size: 1, isDirectory: false, mtime: 1 })

    await statRuntimePath(
      { ...chat, settings: { activeRuntimeEnvironmentId: null }, connectionId: 'ssh-1' },
      OUTSIDE
    )

    expect(fsStat).toHaveBeenCalledWith({ filePath: OUTSIDE, connectionId: 'ssh-1' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('tells an older host apart from a refusal', async () => {
    runtimeEnvironmentCall.mockResolvedValueOnce({
      id: 'rpc-1',
      ok: false,
      error: { code: 'method_not_found', message: 'Unknown method' },
      _meta: { runtimeId: 'remote-runtime' }
    })

    const error = await statRuntimePath(chat, OUTSIDE).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(RecordedFileHostOutdatedError)
    expect(isOutsideRemoteWorkspaceError(error)).toBe(false)
  })

  it('reads a host that will not serve structured chats to this client as needing an update', async () => {
    runtimeEnvironmentCall.mockResolvedValueOnce({
      id: 'rpc-1',
      ok: false,
      error: {
        code: 'runtime_error',
        message: 'structured_agent_session_unsupported'
      },
      _meta: { runtimeId: 'remote-runtime' }
    })

    await expect(statRuntimePath(chat, OUTSIDE)).rejects.toBeInstanceOf(
      RecordedFileHostOutdatedError
    )
  })

  it('surfaces the host refusing a file it has no record of', async () => {
    answer({ ok: false, error: 'not_recorded' })

    const error = await statRuntimePath(chat, '/etc/passwd').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(RecordedFileRefusedError)
    expect(error).toHaveProperty('reason', 'not_recorded')
    expect(isOutsideRemoteWorkspaceError(error)).toBe(true)
  })

  it('words a recorded file that is gone as missing, and no other refusal as missing', async () => {
    expect(isMissingRuntimePathError(new RecordedFileRefusedError('not_found'))).toBe(true)
    for (const reason of [
      'session_not_found',
      'unsupported_location',
      'not_recorded',
      'not_a_file',
      'too_large'
    ] as const) {
      expect(isMissingRuntimePathError(new RecordedFileRefusedError(reason))).toBe(false)
    }
  })
})
