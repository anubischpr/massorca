import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session-journal-types'

const callStructuredAgentSession = vi.fn()
const callRuntimeRpc = vi.fn()
vi.mock('@/runtime/structured-agent-session-client', () => ({ callStructuredAgentSession }))
vi.mock('@/runtime/runtime-rpc-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callRuntimeRpc
}))

const { readSessionChecklistProgress, resetSessionChecklistReaderForTest } =
  await import('./floating-checklist-session-reader')
const { RuntimeRpcCallError } = await import('@/runtime/runtime-rpc-client')

const TARGET = { kind: 'local' } as const

function methodMissing(): Error {
  return new RuntimeRpcCallError({
    id: '1',
    ok: false,
    error: { code: 'method_not_found', message: 'method_not_found' }
  })
}

function reply(markdown: string, observedAt = 10): AgentJournalRenderItem {
  return {
    observedAt,
    body: {
      kind: 'message',
      role: 'assistant',
      blocks: [{ type: 'text', text: markdown }]
    }
  } as unknown as AgentJournalRenderItem
}

const LIST = '```orca-checklist\ntitle: QA\n- [x] One\n- [ ] Two\n- [ ] Three\n```'

function page(items: AgentJournalRenderItem[], hasOlder = false) {
  return {
    ok: true,
    page: { items, hasOlder, window: { oldest: { epoch: 'e', sequence: 1 } } }
  }
}

beforeEach(() => {
  callStructuredAgentSession.mockReset()
  callRuntimeRpc.mockReset()
  resetSessionChecklistReaderForTest()
})

describe('the checklist progress of a session no chat pane is showing', () => {
  it('counts the agent’s latest list from the journal and the person’s marks from the host', async () => {
    callStructuredAgentSession.mockResolvedValue(page([reply(LIST)]))
    callRuntimeRpc.mockResolvedValue({
      ok: true,
      state: { revision: 1, deliveredRevision: 0, title: null, marks: {} }
    })
    expect(await readSessionChecklistProgress(TARGET, 's1')).toEqual({ checked: 1, total: 3 })
  })

  it('still reads the agent’s list from a host that predates the marks methods', async () => {
    callStructuredAgentSession.mockResolvedValue(page([reply(LIST)]))
    callRuntimeRpc.mockRejectedValue(methodMissing())
    expect(await readSessionChecklistProgress(TARGET, 's1')).toEqual({ checked: 1, total: 3 })
  })

  it('pages back through older replies, a bounded number of times, to find a list', async () => {
    callRuntimeRpc.mockRejectedValue(methodMissing())
    callStructuredAgentSession
      .mockResolvedValueOnce(page([reply('hello')], true))
      .mockResolvedValueOnce(page([reply(LIST)], true))
    expect(await readSessionChecklistProgress(TARGET, 's1')).toEqual({ checked: 1, total: 3 })
    expect(callStructuredAgentSession).toHaveBeenCalledTimes(2)
    expect(callStructuredAgentSession.mock.calls[1][2]).toMatchObject({ direction: 'before' })

    resetSessionChecklistReaderForTest()
    callStructuredAgentSession.mockReset()
    callStructuredAgentSession.mockResolvedValue(page([reply('nothing here')], true))
    expect(await readSessionChecklistProgress(TARGET, 's2')).toBeNull()
    expect(callStructuredAgentSession.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('answers with no list when the session cannot be read, and reads a session once while fresh', async () => {
    callStructuredAgentSession.mockRejectedValue(new Error('offline'))
    callRuntimeRpc.mockRejectedValue(new Error('offline'))
    expect(await readSessionChecklistProgress(TARGET, 's1')).toBeNull()
    await readSessionChecklistProgress(TARGET, 's1')
    expect(callStructuredAgentSession).toHaveBeenCalledTimes(1)
  })
})
