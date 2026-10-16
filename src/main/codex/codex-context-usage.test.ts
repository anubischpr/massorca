import { describe, expect, it } from 'vitest'
import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import type { AgentJournalRenderItem } from '../../shared/agent-session-journal-types'
import { selectStructuredAgentContextUsage } from '../../shared/structured-agent-session-context-usage'
import type {
  StructuredAgentSessionEventSink,
  StructuredAgentSessionRevisionJournal
} from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import { createCodexJournalTranslator } from './codex-structured-journal-translation'
import { codexContextUsage } from './codex-context-usage'
import { CODEX_STRUCTURED_AGENT } from './codex-structured-agent-definition'

const usage = (used = 40_000, window: unknown = 200_000) => ({
  last: { totalTokens: used, inputTokens: 123 },
  total: { totalTokens: 8_000_000 },
  modelContextWindow: window
})
function setup() {
  const rows = new Map<string, AgentJournalRenderItem>()
  const writes: string[] = []
  let rejectContext = false
  const append: StructuredAgentSessionEventSink['appendItem'] = (identity, body) => {
    const itemId = agentJournalItemKey(identity)
    const previous = rows.get(itemId)
    rows.set(itemId, {
      itemId,
      body,
      sequence: previous?.sequence ?? rows.size + 1,
      revision: (previous?.revision ?? 0) + 1,
      observedAt: 10
    })
    writes.push(itemId)
  }
  const journal: StructuredAgentSessionRevisionJournal = {
    epoch: 'test',
    itemBody: (id) => rows.get(id)?.body ?? null,
    visitItems: (visit) => {
      for (const row of rows.values()) {
        visit(row.itemId, row.sequence, row.body)
      }
    }
  }
  const revise: NonNullable<StructuredAgentSessionEventSink['tryReviseResolvedItem']> = (
    _bytes,
    resolve,
    options
  ) => {
    const result = resolve(journal)
    if (result) {
      append(result.identity, result.body, options)
    }
    return { accepted: true }
  }
  const sink: StructuredAgentSessionEventSink = {
    appendItem: append,
    appendTombstone: () => {},
    publish: () => {},
    tryAppendTransition: (transition) => {
      for (const step of transition.steps) {
        if (step.kind !== 'settlement') {
          throw new Error('Unexpected context test transition')
        }
        // This context test exercises only the keyed reads used by turn-row revisions.
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the production turn resolver reads only itemBody and visitItems here.
        const mutations = step.resolve(journal as Parameters<typeof step.resolve>[0])
        for (const row of mutations) {
          if (row.kind === 'item' && row.identity) {
            append(row.identity, row.body, { turnScope: row.turnScope })
          }
        }
      }
      return { accepted: true }
    },
    tryReviseResolvedItem: revise,
    tryReviseResolvedItemAndPublish: (...args) =>
      rejectContext ? { accepted: false, reason: 'backpressure' } : revise(...args)
  }
  const translator = createCodexJournalTranslator({
    sink,
    sessionId: 'session',
    primaryThreadId: () => 'root',
    now: () => 10
  })
  const send = (method: string, params: unknown, threadId = 'root') =>
    translator.handle({ type: 'notification', sessionId: 'session', threadId, method, params })
  const start = (turnId = 'turn') => send('turn/started', { turn: { id: turnId } })
  const update = (
    tokenUsage: unknown,
    threadId = 'root',
    turnId = 'turn',
    envelopeThreadId = threadId
  ) => send('thread/tokenUsage/updated', { threadId, turnId, tokenUsage }, envelopeThreadId)
  const command = () => {
    const identity = { provider: 'orca' as const, clientMessageId: 'compact-command' }
    const running = {
      kind: 'turn' as const,
      turnId: 'host-compact',
      state: 'running' as const,
      startedAt: 10
    }
    append(identity, running, { turnScope: { kind: 'thread' } })
    translator.beginCommand({
      clientMessageId: 'compact',
      turnId: running.turnId,
      identity,
      resultIdentity: { provider: 'orca', clientMessageId: 'compact-result' },
      running
    })
  }
  return {
    end: () =>
      translator.handle({
        type: 'ended',
        sessionId: 'session',
        reason: 'lost child',
        cause: 'unexpected-exit',
        fence: 1,
        acquisitionGeneration: 'generation'
      }),
    command,
    rows,
    writes,
    start,
    send,
    update,
    reject: (value: boolean) => {
      rejectContext = value
    },
    context: () => selectStructuredAgentContextUsage([...rows.values()])
  }
}

describe('Codex main-thread active context', () => {
  it('uses the active total, not cumulative accounting or input tokens, and survives turn completion', () => {
    const h = setup()
    h.start()
    expect(h.update(usage())).toEqual({ accepted: true })
    expect(h.context()).toEqual({
      usedTokens: 40_000,
      windowTokens: 200_000,
      percentage: 20,
      estimated: false,
      categories: []
    })
    h.send('turn/completed', { turn: { id: 'turn', status: 'completed' } })
    expect(h.context()?.usedTokens).toBe(40_000)
    expect(CODEX_STRUCTURED_AGENT.capabilities.contextUsage).toBe(true)
  })
  it('ignores child threads, mismatched envelopes and missing root identity', () => {
    const h = setup()
    h.start()
    h.update(usage())
    h.update(usage(190_000), 'child')
    h.update(usage(190_000), 'child', 'turn', 'root')
    h.send('thread/tokenUsage/updated', { turnId: 'turn', tokenUsage: usage(190_000) })
    expect(h.context()?.usedTokens).toBe(40_000)
  })
  it.each([undefined, null, 0, -1, '200000', Number.NaN, Number.POSITIVE_INFINITY])(
    'makes a missing or invalid window unknown: %s',
    (window) => {
      const h = setup()
      h.start()
      h.update(usage())
      const tokenUsage = { ...usage(), modelContextWindow: window }
      h.update(tokenUsage)
      expect(h.context()).toBeNull()
    }
  )
  it.each([
    undefined,
    { total: { totalTokens: 9_000_000 }, modelContextWindow: 200_000 },
    { ...usage(), last: { totalTokens: -1 } },
    { ...usage(), last: { totalTokens: '40000' } }
  ])('does not fall back to cumulative or malformed usage', (tokenUsage) => {
    expect(codexContextUsage({ tokenUsage }, 10)).toEqual({
      used: { kind: 'unknown', capturedAt: 10 }
    })
  })
  it('keeps zero usage valid and leaves over-limit occupancy unclamped', () => {
    const h = setup()
    h.start()
    h.update(usage(0))
    expect(h.context()?.percentage).toBe(0)
    h.update(usage(220_000))
    expect(h.context()?.percentage).toBe(110)
  })
  it('invalidates once per compaction and accepts the next measured context', () => {
    const h = setup()
    h.start()
    h.update(usage())
    h.send('thread/compacted', { threadId: 'root', turnId: 'turn' })
    expect(h.context()).toBeNull()
    h.update(usage(12_000))
    expect(h.context()?.usedTokens).toBe(12_000)
    // The canonical marker replaces its legacy duplicate without erasing a newer observation.
    h.send('item/completed', {
      threadId: 'root',
      turnId: 'turn',
      item: { id: 'compact', type: 'contextCompaction' }
    })
    expect(h.context()?.usedTokens).toBe(12_000)
  })
  it('revises the named turn after completion and never attaches a child measurement to the newest turn', () => {
    const h = setup()
    h.start()
    h.send('turn/completed', { turn: { id: 'turn', status: 'completed' } })
    h.update(usage(24_000))
    expect(h.context()?.usedTokens).toBe(24_000)
    h.start('next')
    h.update(usage(100_000), 'child', 'next')
    expect(h.context()?.usedTokens).toBe(24_000)
  })
  it('propagates sink backpressure so the usage frame can be retried', () => {
    const h = setup()
    h.start()
    h.reject(true)
    expect(h.update(usage())).toEqual({ accepted: false, reason: 'backpressure' })
    expect(h.context()).toBeNull()
    h.reject(false)
    expect(h.update(usage())).toEqual({ accepted: true })
    expect(h.context()?.usedTokens).toBe(40_000)
  })
})

it('keeps manual compaction measurements on the existing host command row, including late updates', () => {
  const h = setup()
  h.start()
  h.update(usage())
  h.send('turn/completed', { turn: { id: 'turn', status: 'completed' } })
  h.command()
  h.start('compact-provider')
  h.send('thread/compacted', { threadId: 'root', turnId: 'compact-provider' })
  expect(h.context()).toBeNull()
  h.update(usage(12_000), 'root', 'compact-provider')
  h.send('turn/completed', { turn: { id: 'compact-provider', status: 'completed' } })
  expect(h.context()?.usedTokens).toBe(12_000)
  h.update(usage(10_000), 'root', 'compact-provider')
  expect(h.context()?.usedTokens).toBe(10_000)
  expect([...h.rows.values()].filter((row) => row.body.kind === 'turn')).toHaveLength(2)
})

it('keeps the last context observation when an unexpected provider exit settles the turn', () => {
  const h = setup()
  h.start()
  h.update(usage())
  expect(h.end()).toEqual({ accepted: true })
  expect(h.context()?.usedTokens).toBe(40_000)
  expect([...h.rows.values()].find((row) => row.body.kind === 'turn')?.body).toMatchObject({
    state: 'interrupted'
  })
})
it('retries compaction invalidation after context-write backpressure without losing the observation', () => {
  const h = setup()
  h.start()
  h.update(usage())
  h.reject(true)
  expect(h.send('thread/compacted', { threadId: 'root', turnId: 'turn' })).toEqual({
    accepted: false,
    reason: 'backpressure'
  })
  expect(h.context()?.usedTokens).toBe(40_000)
  h.reject(false)
  expect(h.send('thread/compacted', { threadId: 'root', turnId: 'turn' })).toEqual({
    accepted: true
  })
  expect(h.context()).toBeNull()
})
