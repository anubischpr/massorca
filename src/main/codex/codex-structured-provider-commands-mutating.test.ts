import { describe, expect, it, vi } from 'vitest'
import * as forkProcess from './codex-forked-thread-process'
import { codexReviewItemBody } from './codex-review-item-translation'
import {
  available,
  observe,
  run,
  CODEX_PROVIDER_COMMANDS
} from './codex-structured-provider-commands'

function session(request: (method: string, params?: Record<string, unknown>) => Promise<unknown>) {
  return {
    threadId: 'thread-1',
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the commands under test call only `request`.
    connection: { request } as never
  }
}

function lastCall(request: ReturnType<typeof vi.fn>): [string, Record<string, unknown>] {
  const call = request.mock.calls.at(-1)
  return [call?.[0], call?.[1]]
}

vi.mock('./codex-forked-thread-process', () => ({
  forkCodexThreadInOwnProcess: vi.fn(async () => null)
}))

describe('codex mutating provider commands', () => {
  it('forks in a process of its own and leaves this app-server out of it', async () => {
    vi.mocked(forkProcess.forkCodexThreadInOwnProcess).mockResolvedValueOnce('thread-9')
    const request = vi.fn(async () => ({}))
    const outcome = await run(session(request), { sessionId: 'session-1', command: 'fork' }, 1000)
    expect(forkProcess.forkCodexThreadInOwnProcess).toHaveBeenCalledWith(
      'session-1',
      'thread-1',
      1000
    )
    expect(request).not.toHaveBeenCalled()
    expect(outcome).toEqual({ ok: true, forkedProviderSessionId: 'thread-9' })
  })

  it('sets the memory mode per thread', async () => {
    const request = vi.fn(async () => ({}))
    await run(session(request), { command: 'memories', argument: 'off' }, 1000)
    expect(lastCall(request)).toEqual([
      'thread/memoryMode/set',
      { threadId: 'thread-1', mode: 'disabled' }
    ])
  })

  it('renames the thread and returns the name for the chat title', async () => {
    const request = vi.fn(async () => ({}))
    const outcome = await run(session(request), { command: 'rename', argument: 'Parser' }, 1000)
    expect(lastCall(request)).toEqual(['thread/name/set', { threadId: 'thread-1', name: 'Parser' }])
    expect(outcome).toMatchObject({ ok: true, conversationName: 'Parser' })
  })

  it('forks, lets this app-server release the fork, and hands its id to the client', async () => {
    let loaded = ['thread-1', 'thread-2']
    const request = vi.fn(async (method: string) => {
      if (method === 'thread/fork') {
        return { thread: { id: 'thread-2' } }
      }
      if (method === 'thread/unsubscribe') {
        return { status: 'unsubscribed' }
      }
      if (method === 'thread/loaded/list') {
        const answer = { data: loaded }
        loaded = ['thread-1']
        return answer
      }
      return {}
    })
    const outcome = await run(session(request), { command: 'fork' }, 1000)
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      'thread/fork',
      'thread/unsubscribe',
      'thread/loaded/list',
      'thread/loaded/list'
    ])
    expect(request).toHaveBeenCalledWith(
      'thread/unsubscribe',
      { threadId: 'thread-2' },
      { timeoutMs: 1000 }
    )
    expect(outcome).toMatchObject({ ok: true, forkedProviderSessionId: 'thread-2' })
  })

  it('still returns the fork when it cannot be released', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'thread/fork') {
        return { thread: { id: 'thread-2' } }
      }
      throw new Error('no such method')
    })
    expect(await run(session(request), { command: 'fork' }, 1000)).toMatchObject({
      ok: true,
      forkedProviderSessionId: 'thread-2'
    })
  })

  it('starts an inline review of the changes, or of the instructions given', async () => {
    const request = vi.fn(async () => ({}))
    await run(session(request), { command: 'review' }, 1000)
    expect(lastCall(request)[1]).toEqual({
      threadId: 'thread-1',
      delivery: 'inline',
      target: { type: 'uncommittedChanges' }
    })
    await run(session(request), { command: 'review', argument: 'the parser' }, 1000)
    expect(lastCall(request)[1]).toMatchObject({
      target: { type: 'custom', instructions: 'the parser' }
    })
  })

  it('cleans the background terminals', async () => {
    const request = vi.fn(async () => ({}))
    await run(session(request), { command: 'stop' }, 1000)
    expect(lastCall(request)).toEqual([
      'thread/backgroundTerminals/clean',
      { threadId: 'thread-1' }
    ])
  })
})

describe('codex /approve', () => {
  const denial = {
    threadId: 'thread-1',
    reviewId: 'review-1',
    turnId: 'turn-1',
    targetItemId: 'item-1',
    decisionSource: 'agent',
    review: { status: 'denied', riskLevel: 'high', rationale: 'deletes files' },
    action: { type: 'applyPatch', cwd: '/repo', files: ['a.ts'] }
  }

  it('is offered only while a denied action waits, and a new turn withdraws it', () => {
    const request = vi.fn(async () => ({}))
    const codex = session(request)
    expect(available(codex)).not.toContain('approve')
    observe(codex, 'item/autoApprovalReview/completed', denial)
    expect(available(codex)).toEqual(CODEX_PROVIDER_COMMANDS)
    observe(codex, 'turn/started', {})
    expect(available(codex)).not.toContain('approve')
    expect(available(undefined)).not.toContain('approve')
  })

  it('sends the denied assessment once, then has nothing to approve', async () => {
    const request = vi.fn(async () => ({}))
    const codex = session(request)
    observe(codex, 'item/autoApprovalReview/completed', denial)

    await run(codex, { command: 'approve' }, 1000)

    expect(lastCall(request)).toEqual([
      'thread/approveGuardianDeniedAction',
      {
        threadId: 'thread-1',
        event: {
          id: 'review-1',
          target_item_id: 'item-1',
          turn_id: 'turn-1',
          status: 'denied',
          risk_level: 'high',
          user_authorization: null,
          rationale: 'deletes files',
          decision_source: 'agent',
          action: { type: 'apply_patch', cwd: '/repo', files: ['a.ts'] }
        }
      }
    ])
    const again = await run(codex, { command: 'approve' }, 1000)
    expect(request).toHaveBeenCalledTimes(1)
    expect(again).toMatchObject({
      ok: true,
      notice: { text: expect.stringContaining('No denied') }
    })
  })

  it('ignores approved reviews and other threads', () => {
    const codex = session(vi.fn())
    observe(codex, 'item/autoApprovalReview/completed', {
      ...denial,
      review: { status: 'approved' }
    })
    observe(codex, 'item/autoApprovalReview/completed', { ...denial, threadId: 'other' })
    expect(available(codex)).not.toContain('approve')
  })
})

describe('codex review items', () => {
  it('names the review on entry and shows its findings as an assistant message on exit', () => {
    expect(
      codexReviewItemBody({ type: 'enteredReviewMode', id: 'i1', review: 'current changes' })
    ).toEqual({ kind: 'status', tone: 'notice', text: 'Reviewing: current changes' })
    expect(
      codexReviewItemBody({ type: 'exitedReviewMode', id: 'i2', review: '**P1** bug in a.ts' })
    ).toEqual({
      kind: 'message',
      role: 'assistant',
      blocks: [{ type: 'text', text: '**P1** bug in a.ts' }]
    })
    expect(codexReviewItemBody({ type: 'agentMessage', id: 'i3', text: 'x' })).toBeNull()
  })
})
