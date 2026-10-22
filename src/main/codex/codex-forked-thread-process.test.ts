import { afterEach, describe, expect, it, vi } from 'vitest'
import { openCodexAppServerConnection } from './codex-app-server-connection'
import {
  forkCodexThreadInOwnProcess,
  rememberCodexSessionLaunch
} from './codex-forked-thread-process'

vi.mock('./codex-app-server-connection', () => ({ openCodexAppServerConnection: vi.fn() }))

afterEach(() => vi.clearAllMocks())

const LAUNCH = {
  command: 'codex',
  args: ['app-server'],
  cwd: '/work',
  codexHome: '/home/.codex',
  env: { PATH: '/bin' },
  resumeThreadId: null
}

function connectionDouble(request: () => Promise<unknown>) {
  const close = vi.fn(async () => true)
  vi.mocked(openCodexAppServerConnection).mockResolvedValue(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fork uses only request and close.
    { request, close } as never
  )
  return close
}

describe('forkCodexThreadInOwnProcess', () => {
  it('forks without hydrating turns in a sibling process and waits for it to exit', async () => {
    rememberCodexSessionLaunch('s1', LAUNCH)
    const request = vi.fn(async () => ({ thread: { id: 'fork-1' } }))
    const close = connectionDouble(request)

    expect(await forkCodexThreadInOwnProcess('s1', 'thread-1', 5000)).toBe('fork-1')

    expect(request).toHaveBeenCalledWith(
      'thread/fork',
      { threadId: 'thread-1', excludeTurns: true },
      { timeoutMs: 5000 }
    )
    // The child has the session's account home but none of its identity.
    expect(vi.mocked(openCodexAppServerConnection).mock.calls[0]?.[0]).toMatchObject({
      command: 'codex',
      cwd: '/work',
      env: { PATH: '/bin', CODEX_HOME: '/home/.codex' }
    })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('answers null, closing the child, when the fork fails or the launch is unknown', async () => {
    rememberCodexSessionLaunch('s2', LAUNCH)
    const close = connectionDouble(async () => {
      throw new Error('refused')
    })
    expect(await forkCodexThreadInOwnProcess('s2', 'thread-1', 5000)).toBeNull()
    expect(close).toHaveBeenCalledTimes(1)
    expect(await forkCodexThreadInOwnProcess('unknown', 'thread-1', 5000)).toBeNull()
  })
})
