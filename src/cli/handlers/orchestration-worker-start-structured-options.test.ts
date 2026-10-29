import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../format', () => ({ printResult: vi.fn() }))
vi.mock('../selectors', () => ({ getTerminalHandle: vi.fn() }))

import { ORCHESTRATION_HANDLERS } from './orchestration'
import { BOOLEAN_FLAGS } from '../args'
import { ORCHESTRATION_WORKER_COMMAND_SPECS } from '../specs/orchestration-worker-specs'
import {
  ORCHESTRATION_WORKER_START_STRUCTURED_OPTIONS_RUNTIME_CAPABILITY,
  RUNTIME_CAPABILITIES
} from '../../shared/protocol-version'

const mutationResult = {
  result: {
    runId: 'run_1',
    taskId: 'task_1',
    dispatchId: 'ctx_1',
    state: 'ready',
    effects: [],
    residualResources: []
  }
}

const invokeWorkerStart = (flags: Map<string, string | boolean>) => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only these four context fields.
  const context = { flags, client: { call: callMock }, cwd: '/tmp/repo', json: true } as never
  return ORCHESTRATION_HANDLERS['orchestration worker-start'](context)
}

describe('orchestration worker-start --chat and --access-mode', () => {
  beforeEach(() => {
    callMock.mockReset()
    process.exitCode = undefined
  })

  it('declares --chat as a boolean flag and --access-mode as a value flag on worker-start', () => {
    const spec = ORCHESTRATION_WORKER_COMMAND_SPECS.find(
      (candidate) => candidate.path.join(' ') === 'orchestration worker-start'
    )
    expect(spec?.allowedFlags).toEqual(expect.arrayContaining(['chat', 'access-mode']))
    expect(BOOLEAN_FLAGS.has('chat')).toBe(true)
    expect(BOOLEAN_FLAGS.has('access-mode')).toBe(false)
  })

  it('gates on the capability and forwards the chat preference and the access mode', async () => {
    callMock
      .mockResolvedValueOnce({
        result: { capabilities: [ORCHESTRATION_WORKER_START_STRUCTURED_OPTIONS_RUNTIME_CAPABILITY] }
      })
      .mockResolvedValueOnce(mutationResult)

    await invokeWorkerStart(
      new Map<string, string | boolean>([
        ['task', 'task_1'],
        ['agent', 'grok'],
        ['chat', true],
        ['access-mode', 'default'],
        ['from', 'term_coord']
      ])
    )

    expect(callMock).toHaveBeenNthCalledWith(1, 'status.get')
    expect(callMock.mock.calls[1]?.[0]).toBe('orchestration.workerStart')
    expect(callMock.mock.calls[1]?.[1]).toMatchObject({
      agent: 'grok',
      preferredMode: 'chat',
      accessMode: 'default'
    })
  })

  it('refuses before any mutation when the connected runtime predates the options', async () => {
    callMock.mockResolvedValueOnce({ result: { capabilities: [] } })

    await expect(
      invokeWorkerStart(
        new Map<string, string | boolean>([
          ['task', 'task_1'],
          ['agent', 'claude'],
          ['chat', true],
          ['from', 'term_coord']
        ])
      )
    ).rejects.toThrow(/does not support worker --chat or --access-mode/)
    expect(callMock).toHaveBeenCalledTimes(1)
    expect(callMock).toHaveBeenCalledWith('status.get')
  })

  it('omits the new fields when neither option is given, so older hosts see the same call', async () => {
    callMock.mockResolvedValueOnce(mutationResult)

    await invokeWorkerStart(
      new Map<string, string | boolean>([
        ['task', 'task_1'],
        ['agent', 'claude'],
        ['from', 'term_coord']
      ])
    )

    expect(callMock).toHaveBeenCalledTimes(1)
    const params = callMock.mock.calls[0]?.[1]
    expect(params).not.toHaveProperty('preferredMode')
    expect(params).not.toHaveProperty('accessMode')
  })

  it('advertises the capability in the aggregate runtime list', () => {
    expect(RUNTIME_CAPABILITIES).toContain(
      ORCHESTRATION_WORKER_START_STRUCTURED_OPTIONS_RUNTIME_CAPABILITY
    )
    expect(ORCHESTRATION_WORKER_START_STRUCTURED_OPTIONS_RUNTIME_CAPABILITY).toBe(
      'orchestration.worker-start.structured-options.v1'
    )
  })
})
