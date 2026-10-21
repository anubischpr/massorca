import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournalIdentity } from '../../../shared/agent-session-journal-types'
import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'
import { createTrackedJournalOpener } from '../agent-session-journal/journal-host-database-test-support'
import type { StructuredAgentSessionAdapter } from './structured-agent-session-adapter'
import { claudeAndCodexAgents } from './structured-agent-session-adapter-router-test-support'
import { createStructuredAgentSessionLogger } from './structured-agent-session-logger'
import {
  performProviderCommand,
  providerCommandPlan
} from './structured-agent-session-provider-command'
import type { AgentSessionTurnContext } from './structured-agent-session-turns'

const IDENTITY: AgentSessionJournalIdentity = {
  sessionId: 'session-1',
  workspaceId: 'workspace-1',
  hostId: 'host-1',
  agent: 'codex',
  providerHandle: codexProviderHandle('thread-1')
}

let root: string | null = null
const journals = createTrackedJournalOpener()

afterEach(async () => {
  await journals.closeAll()
  if (root) {
    await rm(root, { recursive: true, force: true })
    root = null
  }
})

async function openJournal(): Promise<AgentSessionJournal> {
  root ??= await mkdtemp(join(tmpdir(), 'orca-provider-command-'))
  return journals.open({ identity: IDENTITY, stateDirectory: root })
}

function context(
  journal: AgentSessionJournal,
  double: Partial<StructuredAgentSessionAdapter>
): AgentSessionTurnContext {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the command path reads only the provider-command method.
  const adapter = double as StructuredAgentSessionAdapter
  return {
    logger: createStructuredAgentSessionLogger(),
    sessionId: 'session-1',
    journal,
    fence: 1,
    adapter,
    agents: claudeAndCodexAgents(adapter),
    agent: 'codex',
    persistOptions: async () => undefined,
    resolvedBy: 'client-1',
    publish: vi.fn(),
    now: () => 1
  }
}

describe('performProviderCommand', () => {
  it('journals the provider notice as a status row keyed by the operation', async () => {
    const journal = await openJournal()
    const runProviderCommand = vi.fn(async () => ({
      ok: true as const,
      notice: { text: 'Skills (1)\nfoo  bar', presentation: 'command-output' }
    }))

    const result = await performProviderCommand(context(journal, { runProviderCommand }), {
      clientOperationId: 'op-1',
      command: 'skills'
    })

    expect(result).toEqual({ ok: true, value: { command: 'skills' } })
    expect(runProviderCommand).toHaveBeenCalledWith({
      sessionId: 'session-1',
      fence: 1,
      command: 'skills'
    })
    expect(journal.snapshot().items.map((item) => item.body)).toEqual([
      { kind: 'status', text: 'Skills (1)\nfoo  bar', presentation: 'command-output' }
    ])
    await performProviderCommand(context(journal, { runProviderCommand }), {
      clientOperationId: 'op-1',
      command: 'skills'
    })
    expect(journal.snapshot().items).toHaveLength(1)
  })

  it('refuses a command the agent never declared, without calling the provider', async () => {
    const journal = await openJournal()
    const runProviderCommand = vi.fn(async () => ({ ok: true as const }))

    const result = await performProviderCommand(context(journal, { runProviderCommand }), {
      clientOperationId: 'op-2',
      command: 'export'
    })

    expect(result.ok).toBe(false)
    expect(runProviderCommand).not.toHaveBeenCalled()
  })

  it('refuses with the provider words and writes no row when the provider rejects', async () => {
    const journal = await openJournal()
    const result = await performProviderCommand(
      context(journal, { runProviderCommand: async () => ({ ok: false, rejected: 'nope' }) }),
      { clientOperationId: 'op-3', command: 'plugins' }
    )

    expect(result.ok).toBe(false)
    expect(journal.snapshot().items).toEqual([])
  })
})

describe('providerCommandPlan', () => {
  const envelope = {
    sessionId: 'session-1',
    clientOperationId: 'op-4',
    expectedRuntimeFence: 1,
    payloadFingerprint: 'fp'
  }

  it('carries the command and argument in the fingerprinted fields', () => {
    const plan = providerCommandPlan({ envelope, command: 'rename', argument: 'Parser' })
    expect(plan.fields).toEqual({ command: 'rename', argument: 'Parser' })
  })

  it('replays a recorded success, and never reruns a command that starts work', () => {
    const fork = providerCommandPlan({ envelope, command: 'fork' })
    const skills = providerCommandPlan({ envelope, command: 'skills' })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the plan's replay and rerun predicates read nothing from the context.
    const ctx = {} as AgentSessionTurnContext
    expect(fork.replay(ctx, { status: 'unknown' })).toBeNull()
    expect(fork.rerunWhenReplayMissing?.(ctx)).toBe(false)
    expect(skills.rerunWhenReplayMissing?.(ctx)).toBe(true)
  })
})
