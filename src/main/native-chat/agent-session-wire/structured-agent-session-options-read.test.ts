// A chat's options at rest come from the host catalog without waiting on a listing.

import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import { createAgentModelCatalogService } from '../agent-model-catalog/agent-model-catalog-service'
import {
  AgentModelCatalogStore,
  type AgentModelCatalogSuccess
} from '../agent-model-catalog/agent-model-catalog-store'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-host-mutations'
import {
  readStructuredAgentSessionOptions,
  recordStructuredAgentSessionOptionIntent
} from './structured-agent-session-options-read'
import { StructuredAgentSessionTaskQueue } from './structured-agent-session-task-queue'
import {
  NO_STRUCTURED_AGENTS,
  claudeAndCodexDeclared
} from './structured-agent-session-adapter-router-test-support'

const SESSION = 'session-1'

function restingRecord(): AgentSessionRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resting read and the catalog key touch only these fields.
  return {
    provider: 'codex',
    accountHome: { variable: 'CODEX_HOME', path: '/homes/a' },
    location: { wslDistro: null },
    options: {}
  } as unknown as AgentSessionRecord
}

describe('options at rest', () => {
  it('persists access only on the named session and rejects invalid presets', async () => {
    const record = restingRecord()
    const other = restingRecord()
    const persistOptions = vi.fn(async (options: Record<string, string>) => {
      record.options = options
    })
    const ctx = { sessionId: SESSION, persistOptions, publish: vi.fn() }
    const deps = { store: { getRecord: () => record }, agents: claudeAndCodexDeclared() }
    expect(
      await recordStructuredAgentSessionOptionIntent(deps, ctx, {
        key: 'accessMode',
        value: 'default'
      })
    ).toMatchObject({ ok: true })
    expect(record.options).toEqual({ accessMode: 'default' })
    expect(other.options).toEqual({})
    expect(
      await recordStructuredAgentSessionOptionIntent(deps, ctx, {
        key: 'accessMode',
        value: 'invalid'
      })
    ).toMatchObject({ ok: false })
    expect(persistOptions).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('reports access without a model catalog, live=%s', async (running) => {
    const record = { ...restingRecord(), options: { accessMode: 'default' } }
    const session = {
      child: running ? { fence: 1 } : null,
      params: { provider: 'codex' },
      journal: { context: { floor: () => null }, threadGoal: () => null, contextUsage: () => null }
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the options read uses only these declared context members.
    const context = {
      deps: {
        adapter: { readOptions: async () => ({ models: [], current: {} }) },
        agents: claudeAndCodexDeclared(),
        store: { getRecord: () => record }
      },
      serialize: (_id: string, task: () => Promise<unknown>) => task(),
      openConversation: async () => session,
      conversation: async () => session
    } as unknown as StructuredAgentSessionMutationContext
    expect(await readStructuredAgentSessionOptions(context, SESSION)).toMatchObject({
      current: { accessMode: 'default' },
      accessModeSupport: { modes: ['default', 'full-access'], settable: !running }
    })
  })
  it.each(['codex', 'omp', 'grok', 'opencode'] as const)(
    'omits an unknown model for %s while the catalog is unavailable',
    async (provider) => {
      const record = { ...restingRecord(), provider }
      const probe = vi.fn(() => new Promise<AgentModelCatalogSuccess>(() => {}))
      const modelCatalog = createAgentModelCatalogService({
        store: new AgentModelCatalogStore(),
        getRecord: () => record,
        drivesRecord: () => true,
        resolveAccountHome: async () => ({ variable: 'CODEX_HOME', path: '/homes/a' }),
        probes: { codex: probe }
      })
      const resting = {
        child: null,
        params: { provider: 'codex' },
        journal: { context: { floor: () => null } }
      }
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resting read touches only these members.
      const context = {
        deps: {
          adapter: {},
          agents: NO_STRUCTURED_AGENTS,
          store: { getRecord: () => record },
          modelCatalog
        },
        serialize: (_sessionId: string, task: () => Promise<unknown>) => task(),
        openConversation: async () => resting,
        conversation: async () => resting
      } as unknown as StructuredAgentSessionMutationContext

      const result = await readStructuredAgentSessionOptions(context, SESSION)
      expect(probe).toHaveBeenCalledTimes(provider === 'codex' ? 1 : 0)
      expect(result.models).toEqual([])
      expect(result.current).not.toHaveProperty('model')
      record.options = { model: 'later-model', effort: 'off' }
      expect((await readStructuredAgentSessionOptions(context, SESSION)).current).toEqual({
        model: 'later-model',
        effort: 'off'
      })
    }
  )
})

describe('live Codex option reads', () => {
  it('leaves the session lane free while a cold listing waits, then applies it under the child fence', async () => {
    const listing = Promise.withResolvers<void>()
    const queue = new StructuredAgentSessionTaskQueue()
    const child = { fence: 7 }
    const apply = vi.fn(() => ({
      models: [{ id: 'gpt-live', label: 'GPT Live', efforts: [] }],
      current: { model: 'gpt-live' }
    }))
    const prepareReadOptions = vi.fn(async () => {
      await listing.promise
      return apply
    })
    const live = {
      child,
      params: { provider: 'codex' },
      journal: { threadGoal: () => null, contextUsage: () => null, context: { floor: () => null } }
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this read touches only the declared context fields.
    const context = {
      deps: {
        adapter: { prepareReadOptions },
        agents: NO_STRUCTURED_AGENTS,
        store: { getRecord: () => restingRecord() }
      },
      serialize: (sessionId: string, task: () => Promise<unknown>) =>
        queue.serialize(sessionId, task),
      openConversation: async () => live,
      conversation: async () => live
    } as unknown as StructuredAgentSessionMutationContext

    const reading = readStructuredAgentSessionOptions(context, SESSION)
    await vi.waitFor(() =>
      expect(prepareReadOptions).toHaveBeenCalledWith({ sessionId: SESSION, fence: 7 })
    )
    await expect(queue.serialize(SESSION, async () => 'delivery can proceed')).resolves.toBe(
      'delivery can proceed'
    )
    expect(apply).not.toHaveBeenCalled()
    listing.resolve()
    await expect(reading).resolves.toMatchObject({ current: { model: 'gpt-live' } })
    expect(apply).toHaveBeenCalledOnce()
  })

  it('keeps a listing failure visible to the picker', async () => {
    const queue = new StructuredAgentSessionTaskQueue()
    const live = {
      child: { fence: 7 },
      params: { provider: 'codex' },
      journal: { context: { floor: () => null } }
    }
    const failure = new Error('model/list unavailable')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the failed read ends before touching the remaining context fields.
    const context = {
      deps: {
        adapter: {
          prepareReadOptions: async () => {
            throw failure
          }
        },
        agents: NO_STRUCTURED_AGENTS,
        store: { getRecord: () => restingRecord() }
      },
      serialize: (sessionId: string, task: () => Promise<unknown>) =>
        queue.serialize(sessionId, task),
      openConversation: async () => live
    } as unknown as StructuredAgentSessionMutationContext

    await expect(readStructuredAgentSessionOptions(context, SESSION)).rejects.toBe(failure)
    await expect(queue.serialize(SESSION, async () => 'Stop can proceed')).resolves.toBe(
      'Stop can proceed'
    )
  })

  it('does not apply a listing to a replaced child', async () => {
    const listing = Promise.withResolvers<void>()
    const queue = new StructuredAgentSessionTaskQueue()
    const apply = vi.fn(() => ({ models: [], current: { model: 'stale' } }))
    const prepareReadOptions = vi.fn(async () => {
      await listing.promise
      return apply
    })
    const live = {
      child: { fence: 7 },
      params: { provider: 'codex' },
      journal: { context: { floor: () => null } }
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this read touches only the declared context fields.
    const context = {
      deps: {
        adapter: { prepareReadOptions },
        agents: NO_STRUCTURED_AGENTS,
        store: { getRecord: () => restingRecord() }
      },
      serialize: (sessionId: string, task: () => Promise<unknown>) =>
        queue.serialize(sessionId, task),
      openConversation: async () => live,
      conversation: async () => live
    } as unknown as StructuredAgentSessionMutationContext

    const reading = readStructuredAgentSessionOptions(context, SESSION)
    await vi.waitFor(() => expect(prepareReadOptions).toHaveBeenCalledOnce())
    await queue.serialize(SESSION, async () => {
      live.child = { fence: 8 }
    })
    listing.resolve()
    expect((await reading).current).not.toHaveProperty('model')
    expect(apply).not.toHaveBeenCalled()
  })
})
