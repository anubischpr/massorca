import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../../shared/agent-session-record.test-fixture'
import type { AgentSessionStatusSummary } from '../../shared/agent-session-wire'
import type { NativeChatReplySuggestion } from '../../shared/native-chat-reply-suggestion'
import {
  createStructuredReplySuggestionHandler,
  REPLY_SUGGESTION_NATIVE_GRACE_MS,
  REPLY_SUGGESTION_START_DELAY_MS,
  type StructuredReplySuggestionDeps
} from './structured-reply-suggestion'

const exchange = {
  userMessage: 'Fix login',
  assistantMessage: 'The fix is applied and tests pass.'
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

async function settle() {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve()
  }
}

function rig(provider = 'codex', overrides: Partial<StructuredReplySuggestionDeps> = {}) {
  const record: AgentSessionRecord = { ...agentSessionRecordFixture(), provider }
  const waits: number[] = []
  let held: NativeChatReplySuggestion | undefined
  const published: (NativeChatReplySuggestion | null)[] = []
  const deps: StructuredReplySuggestionDeps = {
    getSettings: () => ({}),
    getRecord: () => record,
    hasOpenDispatch: () => false,
    readExchange: vi.fn(async () => exchange),
    readHeld: () => held,
    generate: vi.fn(async () => 'Run the full test suite'),
    cancelGeneration: vi.fn(),
    publish: (_id, suggestion) => {
      published.push(suggestion)
      held = suggestion ?? undefined
    },
    sleep: async (ms) => {
      waits.push(ms)
    },
    logger: { warn: vi.fn(), error: vi.fn() },
    ...overrides
  }
  const handle = createStructuredReplySuggestionHandler(deps)
  const summary = (
    status: AgentSessionStatusSummary['status'],
    extra: Partial<AgentSessionStatusSummary> = {}
  ): AgentSessionStatusSummary => ({
    sessionId: record.sessionId,
    workspaceId: record.location.workspaceId,
    agent: provider,
    status,
    latestPrompt: 'Fix login',
    updatedAt: 100,
    ...(status === 'idle' ? { turnOutcome: 'success' as const } : {}),
    ...extra
  })
  return {
    deps,
    handle,
    summary,
    published,
    waits,
    setHeld: (s: NativeChatReplySuggestion) => (held = s)
  }
}

const live = { replay: false }

describe('structured reply suggestion handler', () => {
  it('suggests once after a turn ends in success, as an emulated suggestion', async () => {
    const { handle, summary, published, waits, deps } = rig('codex')
    handle(summary('working'), live)
    handle(summary('idle', { statusStartedAt: 321 }), live)
    await settle()
    expect(waits).toEqual([REPLY_SUGGESTION_START_DELAY_MS])
    expect(deps.generate).toHaveBeenCalledTimes(1)
    expect(published).toEqual([
      null,
      { turnId: 'emulated-321', text: 'Run the full test suite', source: 'emulated' }
    ])
  })

  it.each([
    ['a failed turn', { turnOutcome: 'failure' as const }],
    ['a cancelled turn', { turnOutcome: 'cancellation' as const }],
    ['an interrupted turn', { turnOutcome: 'interruption' as const }],
    ['a turn with no verdict', { turnOutcome: undefined }]
  ])('skips %s', async (_name, extra) => {
    const { handle, summary, deps } = rig()
    handle(summary('working'), live)
    handle(summary('idle', extra), live)
    await settle()
    expect(deps.generate).not.toHaveBeenCalled()
  })

  it('ignores an idle it never saw work end, and replays', async () => {
    const { handle, summary, deps } = rig()
    handle(summary('idle'), live)
    handle(summary('working'), { replay: true })
    handle(summary('idle'), { replay: true })
    await settle()
    expect(deps.generate).not.toHaveBeenCalled()
  })

  it('respects both settings and open dispatches', async () => {
    for (const settings of [
      { nativeChatReplySuggestions: false },
      { nativeChatEmulatedReplySuggestions: false }
    ]) {
      const { handle, summary, deps } = rig('codex', { getSettings: () => settings })
      handle(summary('working'), live)
      handle(summary('idle'), live)
      await settle()
      expect(deps.generate).not.toHaveBeenCalled()
    }
    const dispatched = rig('codex', { hasOpenDispatch: () => true })
    dispatched.handle(dispatched.summary('working'), live)
    dispatched.handle(dispatched.summary('idle'), live)
    await settle()
    expect(dispatched.deps.generate).not.toHaveBeenCalled()
  })

  it('skips a turn that said too little', async () => {
    const { handle, summary, deps, published } = rig('codex', { readExchange: async () => null })
    handle(summary('working'), live)
    handle(summary('idle'), live)
    await settle()
    expect(deps.generate).not.toHaveBeenCalled()
    expect(published).toEqual([null])
  })

  it('drops a result when a new turn started, cancels the call, and clears the suggestion', async () => {
    const pending = deferred<string | null>()
    const { handle, summary, published, deps } = rig('codex', { generate: () => pending.promise })
    handle(summary('working'), live)
    handle(summary('idle'), live)
    await settle()
    handle(summary('working'), live)
    pending.resolve('Too late')
    await settle()
    expect(deps.cancelGeneration).toHaveBeenCalledTimes(2)
    expect(published.every((entry) => entry === null)).toBe(true)
  })

  it('leaves Claude to its own prediction when one arrives within the grace window', async () => {
    const { handle, summary, deps, waits, setHeld } = rig('claude')
    handle(summary('working'), live)
    handle(summary('idle'), live)
    setHeld({ turnId: 't', text: 'native', source: 'native' })
    await settle()
    expect(waits).toEqual([REPLY_SUGGESTION_NATIVE_GRACE_MS])
    expect(deps.generate).not.toHaveBeenCalled()
  })

  it('asks a model for Claude when no native prediction came', async () => {
    const { handle, summary, deps } = rig('claude')
    handle(summary('working'), live)
    handle(summary('idle'), live)
    await settle()
    expect(deps.generate).toHaveBeenCalledTimes(1)
  })

  it('logs a failed generation and shows nothing', async () => {
    const { handle, summary, published, deps } = rig('codex', {
      generate: async () => {
        throw new Error('spawn failed')
      }
    })
    handle(summary('working'), live)
    handle(summary('idle'), live)
    await settle()
    expect(deps.logger.warn).toHaveBeenCalledWith('Reply suggestion failed', expect.anything())
    expect(published).toEqual([null])
  })
})
