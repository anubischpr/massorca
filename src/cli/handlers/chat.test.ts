import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote: boolean
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()

    constructor(
      _userDataPath?: string,
      _requestTimeoutMs?: number,
      remotePairingCode = process.env.ORCA_PAIRING_CODE ?? null,
      environmentSelector = process.env.ORCA_ENVIRONMENT ?? null
    ) {
      this.isRemote = Boolean(remotePairingCode || environmentSelector)
    }
  }
  // Why: format.ts narrows with `instanceof` against the real error classes.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'
import { CHAT_COMMAND_SPECS } from '../specs/chat'

const results = {
  sessionId: 'chat-1',
  urls: [
    {
      url: 'https://shop-bbb.vercel.app',
      source: 'tool-output',
      itemId: 'i-3',
      loopback: false,
      previous: false
    },
    {
      url: 'https://shop-aaa.vercel.app',
      source: 'tool-output',
      itemId: 'i-1',
      loopback: false,
      previous: true
    },
    {
      url: 'http://localhost:3000',
      source: 'agent-reply',
      itemId: 'i-2',
      loopback: true,
      previous: false
    }
  ],
  files: ['src/app.tsx'],
  hasOlder: false
}

describe('chat results', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    delete process.env.ORCA_WORKTREE_ID
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists environment URLs newest first, marks previous ones, then changed files', async () => {
    queueFixtures(callMock, okFixture('req_results', results))

    await main(['chat', 'results', '--session', 'chat-1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('chat.results', { sessionId: 'chat-1' })
    expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
      [
        'Environment URLs:',
        '  https://shop-bbb.vercel.app  tool-output',
        '  https://shop-aaa.vercel.app  tool-output  previous',
        '  http://localhost:3000  agent-reply',
        'Changed files:',
        '  src/app.tsx'
      ].join('\n')
    )
  })

  it('prints the full JSON response', async () => {
    const response = okFixture('req_results', results)
    queueFixtures(callMock, response)

    await main(['chat', 'results', '--session', 'chat-1', '--json'], '/tmp/repo')

    expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(response)
  })

  it('says when nothing is recorded and when older history was not read', async () => {
    queueFixtures(
      callMock,
      okFixture('req_results', { sessionId: 'chat-1', urls: [], files: [], hasOlder: true })
    )

    await main(['chat', 'results', '--session', 'chat-1'], '/tmp/repo')

    expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
      [
        'Environment URLs:',
        '  none',
        'Changed files:',
        '  none',
        'Older history was not read; results only it records are not listed.'
      ].join('\n')
    )
  })

  it('refuses to run without --session', async () => {
    await main(['chat', 'results'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('documents the command in its help spec', () => {
    const spec = CHAT_COMMAND_SPECS.find((entry) => entry.path.join(' ') === 'chat results')
    expect(spec?.usage).toBe('orca chat results --session <id> [--json]')
    expect(spec?.allowedFlags).toContain('session')
  })
})
