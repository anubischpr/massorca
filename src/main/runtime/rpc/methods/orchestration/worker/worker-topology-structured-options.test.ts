import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createStructuredWorkerSession } = vi.hoisted(() => ({
  createStructuredWorkerSession: vi.fn()
}))

vi.mock('../../orchestration-structured-worker-session', () => ({ createStructuredWorkerSession }))

import { createStructuredWorkerSessionForWorktree, type WorkerEffect } from './worker-topology'

const runtime = { notifyStructuredSessionJournalActivity: vi.fn() }

const start = (
  overrides: Partial<Parameters<typeof createStructuredWorkerSessionForWorktree>[0]> = {}
) =>
  createStructuredWorkerSessionForWorktree({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mocked session factory never reads the runtime.
    runtime: runtime as never,
    worktreeId: 'wt-1',
    agent: 'grok',
    dispatchId: 'dispatch-1',
    effects: [],
    ...overrides
  })

describe('structured worker topology', () => {
  beforeEach(() => {
    createStructuredWorkerSession.mockReset()
    createStructuredWorkerSession.mockResolvedValue({
      identity: { handle: 'structworker_1' },
      host: {},
      fence: 1
    })
  })

  it('accepts a registered agent that is not Claude or Codex, forwarding model, effort and access', async () => {
    const effects: WorkerEffect[] = []
    await start({
      effects,
      launchPreferences: { model: 'grok-code', effort: 'high' },
      accessMode: 'default'
    })
    expect(createStructuredWorkerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'grok',
        worktreeId: 'wt-1',
        dispatchId: 'dispatch-1',
        accessMode: 'default',
        options: { model: 'grok-code', effort: 'high', accessMode: 'default' }
      })
    )
    expect(effects).toEqual([
      expect.objectContaining({ kind: 'terminal', role: 'agent', id: 'structworker_1' })
    ])
  })

  it('forwards a resolved preset to the session, which narrows it for the host-typed create', async () => {
    await start({ agent: 'claude', accessMode: 'accept-edits' })
    expect(createStructuredWorkerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessMode: 'accept-edits',
        options: { accessMode: 'accept-edits' }
      })
    )
  })

  it('seeds no access mode when none was resolved, so the chat keeps its own default', async () => {
    await start({ agent: 'codex', launchPreferences: { model: 'gpt-6-luna' } })
    const call = createStructuredWorkerSession.mock.calls[0]?.[0]
    expect(call.options).toEqual({ model: 'gpt-6-luna' })
    expect(call).not.toHaveProperty('accessMode')
  })

  it('refuses an agent with no structured registration before any session is created', async () => {
    await expect(start({ agent: 'cursor' })).rejects.toThrow(
      /cursor has no structured session on this host/
    )
    expect(createStructuredWorkerSession).not.toHaveBeenCalled()
  })
})
