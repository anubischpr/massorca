import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseArgs, validateCommandAndFlags } from '../args'
import { specPaths } from '../command-spec'
import { printHelp } from '../help'
import { RuntimeClientError, type RuntimeClient } from '../runtime-client'
import { COMMAND_SPECS } from '../specs'
import type { RuntimeWorktreeAgentRow } from '../../shared/runtime-types'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import { WORKTREE_SESSION_HANDLERS } from './worktree-sessions'

const ORIGINAL_EXIT_CODE = process.exitCode
const NOW = 1_800_000_000_000
const MAIN_ID = 'repo-1::/repo/main'
const FEATURE_ID = 'repo-1::/repo/feature'
const MAIN_SELECTOR = `id:${MAIN_ID}`
const SESSION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const CHAT_PANE_KEY = structuredAgentSessionPaneKey(
  structuredAgentSessionTabId(SESSION_ID),
  SESSION_ID
)

function agentRow(
  overrides: Partial<RuntimeWorktreeAgentRow> & Pick<RuntimeWorktreeAgentRow, 'paneKey'>
): RuntimeWorktreeAgentRow {
  return {
    parentPaneKey: null,
    state: 'working',
    agentType: 'claude',
    prompt: '',
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: NOW - 60_000,
    updatedAt: NOW - 1_000,
    ...overrides
  }
}

// Rows as `worktree.ps` publishes them: a host-owned chat with no terminal, a terminal agent,
// a row with neither a live terminal nor a chat behind it, and a row of another worktree.
const chatRow = agentRow({
  paneKey: CHAT_PANE_KEY,
  prompt: 'ship the thing',
  structuredHostOwned: true,
  stateStartedAt: NOW - 12 * 60_000
})
const terminalRow = agentRow({
  paneKey: 'tab-1:leaf-1',
  state: 'done',
  agentType: 'codex',
  taskTitle: 'Fix login',
  terminalHandle: 'term_abc123',
  stateStartedAt: NOW - 2 * 3_600_000
})
const untrackedRow = agentRow({
  paneKey: 'tab-2:leaf-2',
  state: 'blocked',
  agentType: null,
  prompt: 'approve?',
  stateStartedAt: NOW - 45_000
})
const featureRow = agentRow({ paneKey: 'tab-9:leaf-9', terminalHandle: 'term_other' })

function ok(result: unknown) {
  return { id: 'req-1', ok: true, result, _meta: { runtimeId: 'runtime-1' } }
}

const showReply = ok({ worktree: { id: MAIN_ID, path: '/repo/main' } })
const psReply = ok({
  worktrees: [
    { worktreeId: MAIN_ID, agents: [chatRow, terminalRow, untrackedRow] },
    { worktreeId: FEATURE_ID, agents: [featureRow] }
  ],
  totalCount: 2,
  truncated: false
})

type Reply = unknown | (() => unknown)

// Answers only the RPCs a test names, so any other call fails the test.
function fakeClient(replies: Record<string, Reply>) {
  const call = vi.fn(async (method: string, _params?: unknown) => {
    if (!(method in replies)) {
      throw new Error(`unexpected RPC: ${method}`)
    }
    const reply = replies[method]
    return typeof reply === 'function' ? reply() : reply
  })
  return { call, client: { call } as unknown as RuntimeClient }
}

function methodsCalled(call: ReturnType<typeof fakeClient>['call']): string[] {
  return call.mock.calls.map(([method]) => method)
}

function ctx(client: RuntimeClient, flags: [string, string | boolean][], json = true) {
  return { flags: new Map(flags), client, cwd: '/tmp/worktree', json }
}

function outputLines(log: ReturnType<typeof vi.spyOn>): string {
  return log.mock.calls.map(([line]) => String(line)).join('\n')
}

describe('worktree sessions CLI', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    process.exitCode = ORIGINAL_EXIT_CODE
  })

  it("lists the selected worktree's sessions as JSON with id, kind, agent, title, state and start", async () => {
    process.exitCode = undefined
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { call, client } = fakeClient({ 'worktree.show': showReply, 'worktree.ps': psReply })

    await WORKTREE_SESSION_HANDLERS['worktree sessions'](ctx(client, [['worktree', MAIN_SELECTOR]]))

    expect(call).toHaveBeenCalledWith('worktree.show', { worktree: MAIN_SELECTOR })
    expect(call).toHaveBeenCalledWith('worktree.ps', { limit: 10_000 })
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      ok: true,
      result: {
        worktreeId: MAIN_ID,
        sessions: [
          {
            id: SESSION_ID,
            kind: 'chat',
            agent: 'claude',
            title: 'ship the thing',
            state: 'working',
            stateStartedAt: NOW - 12 * 60_000,
            paneKey: CHAT_PANE_KEY
          },
          {
            id: 'term_abc123',
            kind: 'terminal',
            agent: 'codex',
            title: 'Fix login',
            state: 'done',
            stateStartedAt: NOW - 2 * 3_600_000
          },
          {
            id: 'tab-2:leaf-2',
            kind: null,
            agent: null,
            title: 'approve?',
            state: 'blocked',
            stateStartedAt: NOW - 45_000
          }
        ]
      }
    })
    expect(process.exitCode).toBeUndefined()
  })

  it('prints one line per session in text: id, agent, state, age and title', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { client } = fakeClient({ 'worktree.show': showReply, 'worktree.ps': psReply })

    await WORKTREE_SESSION_HANDLERS['worktree sessions'](
      ctx(client, [['worktree', MAIN_SELECTOR]], false)
    )

    expect(outputLines(log)).toBe(
      [
        `${SESSION_ID}  claude  working  12m  ship the thing`,
        'term_abc123  codex  done  2h  Fix login',
        'tab-2:leaf-2  -  blocked  45s  approve?'
      ].join('\n')
    )
  })

  it('says so in text, and lists nothing in JSON, when the worktree has no sessions', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': ok({
        worktrees: [{ worktreeId: MAIN_ID, agents: [] }],
        totalCount: 1,
        truncated: false
      })
    })

    await WORKTREE_SESSION_HANDLERS['worktree sessions'](
      ctx(client, [['worktree', MAIN_SELECTOR]], false)
    )
    await WORKTREE_SESSION_HANDLERS['worktree sessions'](ctx(client, [['worktree', MAIN_SELECTOR]]))

    expect(String(log.mock.calls[0]?.[0])).toBe('No agent sessions in this worktree.')
    expect(JSON.parse(String(log.mock.calls[1]?.[0]))).toMatchObject({
      ok: true,
      result: { sessions: [] }
    })
  })

  it('closes a terminal session through terminal.close, using the id the list printed', async () => {
    process.exitCode = undefined
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { call, client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': psReply,
      'terminal.close': ok({ close: { handle: 'term_abc123', tabId: 'tab-1', ptyKilled: true } })
    })

    await WORKTREE_SESSION_HANDLERS['worktree session-close'](
      ctx(client, [
        ['worktree', MAIN_SELECTOR],
        ['session', 'term_abc123']
      ])
    )

    expect(call).toHaveBeenCalledWith('terminal.close', { terminal: 'term_abc123' })
    expect(methodsCalled(call)).not.toContain('agentSession.close')
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      ok: true,
      result: {
        session: { id: 'term_abc123', kind: 'terminal' },
        close: { ptyKilled: true }
      }
    })
    expect(process.exitCode).toBeUndefined()
  })

  it('closes a chat session through agentSession.close, the call closing its tab makes', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { call, client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': psReply,
      'agentSession.close': ok({ ok: true })
    })

    await WORKTREE_SESSION_HANDLERS['worktree session-close'](
      ctx(
        client,
        [
          ['worktree', MAIN_SELECTOR],
          ['session', SESSION_ID]
        ],
        false
      )
    )

    expect(call).toHaveBeenCalledWith('agentSession.close', { sessionId: SESSION_ID })
    expect(methodsCalled(call)).not.toContain('terminal.close')
    expect(String(log.mock.calls[0]?.[0])).toBe(`Closed chat session ${SESSION_ID}.`)
  })

  it('refuses an id that is not a session of this worktree and closes nothing', async () => {
    const { call, client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': psReply,
      'terminal.close': ok({}),
      'agentSession.close': ok({ ok: true })
    })

    await expect(
      WORKTREE_SESSION_HANDLERS['worktree session-close'](
        ctx(client, [
          ['worktree', MAIN_SELECTOR],
          ['session', 'term_other']
        ])
      )
    ).rejects.toMatchObject({ code: 'agent_session_not_found' })
    expect(methodsCalled(call)).not.toContain('terminal.close')
    expect(methodsCalled(call)).not.toContain('agentSession.close')
  })

  it('refuses a session with no terminal or chat behind it and closes nothing', async () => {
    const { call, client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': psReply,
      'terminal.close': ok({}),
      'agentSession.close': ok({ ok: true })
    })

    await expect(
      WORKTREE_SESSION_HANDLERS['worktree session-close'](
        ctx(client, [
          ['worktree', MAIN_SELECTOR],
          ['session', 'tab-2:leaf-2']
        ])
      )
    ).rejects.toMatchObject({ code: 'agent_session_not_closable' })
    expect(methodsCalled(call)).not.toContain('terminal.close')
    expect(methodsCalled(call)).not.toContain('agentSession.close')
  })

  it('reports a host that predates agentSession.close as incompatible_runtime', async () => {
    const { client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': psReply,
      'agentSession.close': () => {
        throw new RuntimeClientError('method_not_found', 'Unknown method: agentSession.close')
      }
    })

    await expect(
      WORKTREE_SESSION_HANDLERS['worktree session-close'](
        ctx(client, [
          ['worktree', MAIN_SELECTOR],
          ['session', SESSION_ID]
        ])
      )
    ).rejects.toMatchObject({ code: 'incompatible_runtime' })
  })

  it('exits 1 with the live-PTY failure when terminal.close does not confirm the stop', async () => {
    process.exitCode = undefined
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const close = {
      handle: 'term_abc123',
      tabId: 'tab-1',
      ptyKilled: false,
      ptyStopVerdict: 'live' as const
    }
    const { client } = fakeClient({
      'worktree.show': showReply,
      'worktree.ps': psReply,
      'terminal.close': ok({ close })
    })

    await WORKTREE_SESSION_HANDLERS['worktree session-close'](
      ctx(client, [
        ['worktree', MAIN_SELECTOR],
        ['session', 'term_abc123']
      ])
    )

    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      ok: false,
      error: { code: 'terminal_stop_live' }
    })
    expect(process.exitCode).toBe(1)
  })

  it('requires --session before it reads or closes anything', async () => {
    const { call, client } = fakeClient({ 'worktree.show': showReply, 'worktree.ps': psReply })

    await expect(
      WORKTREE_SESSION_HANDLERS['worktree session-close'](
        ctx(client, [['worktree', MAIN_SELECTOR]])
      )
    ).rejects.toThrow('Missing required --session')
    expect(call).not.toHaveBeenCalled()
  })

  it('parses both commands with the flags they document', () => {
    const paths = COMMAND_SPECS.flatMap((spec) => specPaths(spec))

    const list = parseArgs(
      ['worktree', 'sessions', '--worktree', 'active', '--json'],
      paths,
      COMMAND_SPECS
    )
    expect(list.commandPath).toEqual(['worktree', 'sessions'])
    expect(() => validateCommandAndFlags(COMMAND_SPECS, list)).not.toThrow()

    const close = parseArgs(
      ['worktree', 'session-close', '--worktree', 'active', '--session', 'term_abc123'],
      paths,
      COMMAND_SPECS
    )
    expect(close.commandPath).toEqual(['worktree', 'session-close'])
    expect(close.flags.get('session')).toBe('term_abc123')
    expect(() => validateCommandAndFlags(COMMAND_SPECS, close)).not.toThrow()
  })

  it('prints session-close usage with --worktree and --session', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    printHelp(COMMAND_SPECS, ['worktree', 'session-close'])

    expect(outputLines(log)).toContain(
      'orca worktree session-close --worktree <selector> --session <id>'
    )
  })
})
