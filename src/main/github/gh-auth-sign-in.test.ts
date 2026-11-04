import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GhSignInEvent } from '../../preload/api/github-account-api'
import type { spawnProcess } from '../../shared/child-process/run-process'
import type { ProcessSpec } from '../../shared/child-process/process-spec'
import {
  cancelGhSignIn,
  isValidGhSignInHost,
  parseGhSignInCode,
  parseGhSignInUser,
  parseGhSignInVerificationUrl,
  readGhSignInStartArgs,
  startGhSignIn,
  type GhSignInDeps
} from './gh-auth-sign-in'

// Real gh output: the code line is on stderr; with a TTY gh also prints "Press Enter".
const PRESS_ENTER_OUTPUT = [
  '! First copy your one-time code: ABCD-1234',
  'Press Enter to open github.com in your browser...'
].join('\n')
const OPEN_URL_OUTPUT = [
  '! First copy your one-time code: WXYZ-5678',
  'Open https://github.com/login/device in your browser to continue...'
].join('\n')
const SUCCESS_OUTPUT = [
  '✓ Authentication complete.',
  '- gh config set -h github.com git_protocol https',
  '✓ Configured git protocol',
  '✓ Logged in as octocat'
].join('\n')

class FakeGhChild extends EventEmitter {
  readonly stdout = new EventEmitter()
  readonly stderr = new EventEmitter()

  print(text: string): void {
    this.stderr.emit('data', Buffer.from(text))
  }

  exit(code: number): void {
    this.emit('close', code)
  }
}

function asSpawned(child: FakeGhChild): ReturnType<typeof spawnProcess> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake provides only the stream and event surface the sign-in reads.
  return child as unknown as ReturnType<typeof spawnProcess>
}

function makeDeps(child: FakeGhChild, overrides: Partial<GhSignInDeps> = {}): GhSignInDeps {
  return {
    resolveGh: vi.fn((args: string[]) => ({ program: 'gh', args })),
    spawn: vi.fn((_spec: ProcessSpec) => asSpawned(child)),
    run: vi.fn(async () => ({
      code: 0,
      signal: null,
      stdout: 'Usage: gh auth login [flags]',
      stderr: '',
      timedOut: false
    })),
    killTree: vi.fn(async () => true),
    env: () => ({ NO_COLOR: '1' }),
    timeoutMs: 60_000,
    onSignedIn: vi.fn(),
    lookupActiveUser: vi.fn(async () => null),
    ...overrides
  }
}

const events: GhSignInEvent[] = []
const emit = (event: GhSignInEvent): void => {
  events.push(event)
}
const statesFor = (signInId: string): GhSignInEvent['state'][] =>
  events.filter((e) => e.signInId === signInId).map((e) => e.state)

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const started: string[] = []
function start(
  signInId: string,
  deps: GhSignInDeps,
  host = 'github.com'
): ReturnType<typeof startGhSignIn> {
  started.push(signInId)
  return startGhSignIn({ signInId, host }, emit, deps)
}

afterEach(() => {
  for (const id of started.splice(0)) {
    cancelGhSignIn(id)
  }
  events.length = 0
  vi.useRealTimers()
})

describe('gh sign-in output parsing', () => {
  it('reads the one-time code from both gh output shapes', () => {
    expect(parseGhSignInCode(PRESS_ENTER_OUTPUT)).toBe('ABCD-1234')
    expect(parseGhSignInCode(OPEN_URL_OUTPUT)).toBe('WXYZ-5678')
    expect(parseGhSignInCode('\u001b[1m! First copy your one-time code: abcd-9876\u001b[0m')).toBe(
      'ABCD-9876'
    )
    expect(parseGhSignInCode('no code yet')).toBeNull()
  })

  it('takes the verification URL only when it is on the sign-in host', () => {
    expect(parseGhSignInVerificationUrl(OPEN_URL_OUTPUT, 'github.com')).toBe(
      'https://github.com/login/device'
    )
    expect(parseGhSignInVerificationUrl(PRESS_ENTER_OUTPUT, 'github.com')).toBeNull()
    expect(
      parseGhSignInVerificationUrl('Open https://evil.example/login/device now', 'github.com')
    ).toBeNull()
    expect(
      parseGhSignInVerificationUrl('Open https://ghe.corp.test/login/device.', 'ghe.corp.test')
    ).toBe('https://ghe.corp.test/login/device')
  })

  it('reads the new login from the success line', () => {
    expect(parseGhSignInUser(SUCCESS_OUTPUT)).toBe('octocat')
    expect(parseGhSignInUser('✓ Authentication complete.')).toBeNull()
  })

  it('accepts only bare hostnames for sign-in', () => {
    expect(isValidGhSignInHost('github.com')).toBe(true)
    expect(isValidGhSignInHost('ghe.corp.test')).toBe(true)
    expect(isValidGhSignInHost('-x')).toBe(false)
    expect(isValidGhSignInHost('github.com:443')).toBe(false)
    expect(isValidGhSignInHost('git hub.com')).toBe(false)
    expect(isValidGhSignInHost('')).toBe(false)
  })

  it('normalizes IPC args and rejects bad ids or hosts', () => {
    expect(readGhSignInStartArgs({ signInId: 'abc-123', host: ' GitHub.com ' })).toEqual({
      signInId: 'abc-123',
      host: 'github.com'
    })
    expect(readGhSignInStartArgs({ signInId: 'abc-123' })).toEqual({
      signInId: 'abc-123',
      host: 'github.com'
    })
    expect(readGhSignInStartArgs({ signInId: 'bad id!', host: 'github.com' })).toBeNull()
    expect(readGhSignInStartArgs({ signInId: 'ok', host: '--evil' })).toBeNull()
    expect(readGhSignInStartArgs(null)).toBeNull()
  })
})

describe('startGhSignIn', () => {
  it('runs gh with argv only, no shell, and no ambient token in the child env', async () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child)
    expect(start('run-argv', deps, 'ghe.corp.test')).toEqual({ ok: true })
    await flush()
    expect(deps.spawn).toHaveBeenCalledTimes(1)
    const spec = vi.mocked(deps.spawn).mock.calls[0][0]
    expect(spec.program).toBe('gh')
    expect(spec.args).toEqual([
      'auth',
      'login',
      '--hostname',
      'ghe.corp.test',
      '--web',
      '--git-protocol',
      'https'
    ])
    child.exit(0)
  })

  it('passes --skip-ssh-key only when the installed gh lists it', async () => {
    const supported = new FakeGhChild()
    const supportedDeps = makeDeps(supported, {
      run: vi.fn(async () => ({
        code: 0,
        signal: null,
        stdout: '  --skip-ssh-key   Skip generating or uploading an SSH key',
        stderr: '',
        timedOut: false
      }))
    })
    start('skip-yes', supportedDeps)
    await flush()
    expect(vi.mocked(supportedDeps.spawn).mock.calls[0][0].args).toContain('--skip-ssh-key')
    supported.exit(0)
  })

  it('emits the code with the parsed URL once it appears, across chunks', async () => {
    const child = new FakeGhChild()
    start('chunks', makeDeps(child))
    await flush()
    child.print('! First copy your one-time code: ')
    expect(statesFor('chunks')).toEqual([])
    child.print('ABCD-1234\nOpen https://github.com/login/device in your browser')
    expect(statesFor('chunks')).toEqual([
      {
        kind: 'code',
        userCode: 'ABCD-1234',
        verificationUrl: 'https://github.com/login/device'
      }
    ])
    child.print('\n')
    expect(statesFor('chunks')).toHaveLength(1)
    child.exit(1)
  })

  it('falls back to the sign-in host device URL when gh prints none', async () => {
    const child = new FakeGhChild()
    start('fallback-url', makeDeps(child), 'ghe.corp.test')
    await flush()
    child.print(PRESS_ENTER_OUTPUT)
    expect(statesFor('fallback-url')[0]).toEqual({
      kind: 'code',
      userCode: 'ABCD-1234',
      verificationUrl: 'https://ghe.corp.test/login/device'
    })
    child.exit(1)
  })

  it('refreshes caches then reports done with the new login', async () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child)
    start('success', deps)
    await flush()
    child.print(OPEN_URL_OUTPUT)
    child.print(`\n${SUCCESS_OUTPUT}`)
    child.exit(0)
    await flush()
    expect(deps.onSignedIn).toHaveBeenCalledTimes(1)
    expect(statesFor('success').at(-1)).toEqual({ kind: 'done', user: 'octocat' })
  })

  it('reads the active login when the success output does not name it', async () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child, { lookupActiveUser: vi.fn(async () => 'fallback-user') })
    start('lookup', deps)
    await flush()
    child.print(OPEN_URL_OUTPUT)
    child.exit(0)
    await flush()
    expect(deps.lookupActiveUser).toHaveBeenCalledWith('github.com')
    expect(statesFor('lookup').at(-1)).toEqual({ kind: 'done', user: 'fallback-user' })
  })

  it('reports failed and never reports done when gh exits non-zero', async () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child)
    start('exit-1', deps)
    await flush()
    child.print(OPEN_URL_OUTPUT)
    child.exit(1)
    await flush()
    expect(statesFor('exit-1').at(-1)).toEqual({ kind: 'failed', reason: 'failed' })
    expect(deps.onSignedIn).not.toHaveBeenCalled()
  })

  it('reports unavailable when gh cannot start', async () => {
    const child = new FakeGhChild()
    start('no-gh', makeDeps(child))
    await flush()
    child.emit('error', new Error('spawn gh ENOENT'))
    expect(statesFor('no-gh')).toEqual([{ kind: 'failed', reason: 'unavailable' }])
  })

  it('cancel kills the child tree and ignores its later exit', async () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child)
    start('cancel-me', deps)
    await flush()
    child.print(OPEN_URL_OUTPUT)
    cancelGhSignIn('cancel-me')
    expect(deps.killTree).toHaveBeenCalledWith(child)
    child.exit(0)
    await flush()
    expect(statesFor('cancel-me')).toEqual([
      expect.objectContaining({ kind: 'code' }),
      { kind: 'failed', reason: 'cancelled' }
    ])
    expect(deps.onSignedIn).not.toHaveBeenCalled()
  })

  it('cancel before the child starts stops the flow without spawning', async () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child)
    start('early-cancel', deps)
    cancelGhSignIn('early-cancel')
    await flush()
    expect(deps.spawn).not.toHaveBeenCalled()
    expect(statesFor('early-cancel')).toEqual([{ kind: 'failed', reason: 'cancelled' }])
  })

  it('times out after the limit, killing gh', async () => {
    vi.useFakeTimers()
    const child = new FakeGhChild()
    const deps = makeDeps(child, { timeoutMs: 1_000 })
    start('slow', deps)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(deps.killTree).toHaveBeenCalledWith(child)
    expect(statesFor('slow')).toEqual([{ kind: 'failed', reason: 'timeout' }])
  })

  it('a newer start replaces the active sign-in', async () => {
    const firstChild = new FakeGhChild()
    const secondChild = new FakeGhChild()
    const firstDeps = makeDeps(firstChild)
    start('first', firstDeps)
    await flush()
    start('second', makeDeps(secondChild))
    await flush()
    expect(firstDeps.killTree).toHaveBeenCalledWith(firstChild)
    expect(statesFor('first')).toEqual([{ kind: 'failed', reason: 'cancelled' }])
  })

  it('refuses an invalid host before running anything', () => {
    const child = new FakeGhChild()
    const deps = makeDeps(child)
    expect(startGhSignIn({ signInId: 'bad-host', host: '-evil' }, emit, deps)).toEqual({
      ok: false,
      reason: 'invalid_host'
    })
    expect(deps.spawn).not.toHaveBeenCalled()
  })

  it('never emits token-shaped output, only the code, URL and login', async () => {
    const child = new FakeGhChild()
    start('no-token', makeDeps(child))
    await flush()
    child.print(`${OPEN_URL_OUTPUT}\nGH_TOKEN=gho_SECRETVALUE123\ngho_SECRETVALUE123`)
    child.print(`\n${SUCCESS_OUTPUT}`)
    child.exit(0)
    await flush()
    expect(JSON.stringify(events)).not.toContain('gho_')
    expect(JSON.stringify(events)).not.toContain('SECRETVALUE')
  })
})
