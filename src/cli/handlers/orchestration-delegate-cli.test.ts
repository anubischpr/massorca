import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../format', () => ({ printResult: vi.fn() }))
vi.mock('../selectors', () => ({ getTerminalHandle: vi.fn() }))

import { ORCHESTRATION_HANDLERS } from './orchestration'
import { BOOLEAN_FLAGS } from '../args'
import { ORCHESTRATION_COMMAND_SPECS } from '../specs/orchestration'
import {
  ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY,
  RUNTIME_CAPABILITIES
} from '../../shared/protocol-version'

const RECEIPT = {
  result: {
    requestId: 'deleg_aaaaaaaaaaaa',
    status: 'awaiting_choice',
    questionItemId: 'orca:delegation%3Adeleg_aaaaaaaaaaaa'
  }
}

const invoke = (flags: Map<string, string | boolean>) => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only these four context fields.
  const context = { flags, client: { call: callMock }, cwd: '/tmp/repo', json: true } as never
  return ORCHESTRATION_HANDLERS['orchestration delegate'](context)
}

const flagsFor = (extra: Record<string, string | boolean> = {}) =>
  new Map<string, string | boolean>(
    Object.entries({
      summary: 'Read only audit of a parser module',
      prompt: 'Read src/parser and list every unsafe cast.',
      ...extra
    })
  )

describe('orchestration delegate', () => {
  beforeEach(() => {
    callMock.mockReset()
    process.exitCode = undefined
    vi.stubEnv('ORCA_AGENT_SESSION_ID', 'session_parent_01')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is a documented command with --writes as a boolean flag and no caller flag', () => {
    const spec = ORCHESTRATION_COMMAND_SPECS.find(
      (candidate) => candidate.path.join(' ') === 'orchestration delegate'
    )
    expect(spec?.allowedFlags).toEqual(
      expect.arrayContaining(['summary', 'prompt', 'title', 'writes', 'retry-request'])
    )
    expect(spec?.allowedFlags).not.toContain('from')
    expect(BOOLEAN_FLAGS.has('writes')).toBe(true)
    expect(BOOLEAN_FLAGS.has('summary')).toBe(false)
    expect(RUNTIME_CAPABILITIES).toContain(ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY)
  })

  it('refuses outside a chat session before it calls the runtime', async () => {
    vi.stubEnv('ORCA_AGENT_SESSION_ID', '')

    await expect(invoke(flagsFor())).rejects.toMatchObject({ code: 'delegation_requires_chat' })
    expect(callMock).not.toHaveBeenCalled()
  })

  it('refuses a summary that is a task rather than an abstract', async () => {
    await expect(invoke(flagsFor({ summary: 'x'.repeat(161) }))).rejects.toMatchObject({
      code: 'invalid_argument'
    })
    await expect(invoke(flagsFor({ summary: 'line one\nline two' }))).rejects.toMatchObject({
      code: 'invalid_argument'
    })
    expect(callMock).not.toHaveBeenCalled()
  })

  it('refuses a runtime that predates delegation before it files anything', async () => {
    callMock.mockResolvedValueOnce({ result: { capabilities: [] } })

    await expect(invoke(flagsFor())).rejects.toMatchObject({ code: 'incompatible_runtime' })
    expect(callMock).toHaveBeenCalledTimes(1)
    expect(callMock).toHaveBeenCalledWith('status.get')
  })

  it('files the request and returns at once with the request id', async () => {
    callMock
      .mockResolvedValueOnce({
        result: { capabilities: [ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY] }
      })
      .mockResolvedValueOnce(RECEIPT)

    await invoke(flagsFor({ title: 'Parser audit', writes: true }))

    expect(callMock.mock.calls[1]?.[0]).toBe('orchestration.delegateRequest')
    expect(callMock.mock.calls[1]?.[1]).toEqual({
      summary: 'Read only audit of a parser module',
      prompt: 'Read src/parser and list every unsafe cast.',
      title: 'Parser audit',
      writes: true
    })
  })

  it('sends neither a title nor writes that were not given', async () => {
    callMock
      .mockResolvedValueOnce({
        result: { capabilities: [ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY] }
      })
      .mockResolvedValueOnce(RECEIPT)

    await invoke(flagsFor())

    expect(callMock.mock.calls[1]?.[1]).toEqual({
      summary: 'Read only audit of a parser module',
      prompt: 'Read src/parser and list every unsafe cast.'
    })
  })
})
