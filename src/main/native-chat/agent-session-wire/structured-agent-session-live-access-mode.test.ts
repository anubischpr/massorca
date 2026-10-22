import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { computeAgentSessionPayloadFingerprint } from '../../../shared/agent-session-mutation-envelope'
import type { AgentSessionMutationEnvelope } from '../../../shared/agent-session-wire'
import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
import { CODEX_STRUCTURED_AGENT } from '../../codex/codex-structured-agent-definition'
import type { AgentSessionRecordStore } from '../../runtime/agent-session-record-store'
import { openTestAgentSessionRecordStore } from '../../runtime/agent-session-record-store-test-harness'
import {
  closeTestJournalHostDatabase,
  openTestJournalHostDatabase
} from '../agent-session-journal/journal-host-database-test-support'
import type { StructuredAgentSessionAdapter } from './structured-agent-session-adapter'
import { StructuredAgentRegistry } from './structured-agent-registry'
import { StructuredAgentSessionHost } from './structured-agent-session-host'
import {
  HOST_TEST_NOW as NOW,
  HOST_TEST_SESSION as SESSION,
  HOST_TEST_THREAD as THREAD,
  hostTestAttachParams,
  hostTestOperationId,
  resetHostTestOperationIds
} from './structured-agent-session-host-test-data'
import { createStructuredAgentSessionLogger } from './structured-agent-session-logger'

const CALLER = { callerKey: 'client-1' }

let root: string
let store: AgentSessionRecordStore
let host: StructuredAgentSessionHost
let setOption: Mock<StructuredAgentSessionAdapter['setOption']>

function envelope(fields: Record<string, unknown>): AgentSessionMutationEnvelope {
  return {
    sessionId: SESSION,
    clientOperationId: hostTestOperationId(),
    expectedRuntimeFence: store.getRecord(SESSION)?.lease.runtimeFence ?? null,
    payloadFingerprint: computeAgentSessionPayloadFingerprint({
      method: 'agentSession.setOption',
      sessionId: SESSION,
      fields
    })
  }
}

function adapter(): StructuredAgentSessionAdapter {
  setOption = vi.fn<StructuredAgentSessionAdapter['setOption']>(async () => ({
    model: 'gpt-default'
  }))
  return {
    supportsLocation: () => true,
    acquire: vi.fn(async ({ fence, spawnToken }) => ({
      process: { hostId: 'local', pid: 4200, processStartTimeMs: NOW, spawnToken },
      link: {
        linkId: `native-link-${fence}`,
        handle: codexProviderHandle(THREAD),
        origin: 'created' as const,
        mintedAtFence: fence,
        observedAt: NOW
      }
    })),
    dispatch: vi.fn(),
    cancelTurn: vi.fn(async () => ({ cancelled: true })),
    answerPrompt: vi.fn(async () => undefined),
    setOption,
    readOptions: vi.fn(async () => ({ current: { model: 'gpt-default' }, models: [] })),
    // The adapter would let a running child switch to these; the agent declares only some of them.
    liveAccessModes: () => ['auto', 'plan'],
    closeSession: vi.fn(async () => true),
    rewind: vi.fn(),
    recoverRewind: vi.fn(),
    compact: vi.fn(),
    changeThreadGoal: vi.fn(),
    runProviderCommand: vi.fn()
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-live-access-'))
  resetHostTestOperationIds()
  store = await openTestAgentSessionRecordStore(root)
  const native = adapter()
  host = new StructuredAgentSessionHost({
    agents: new StructuredAgentRegistry([{ definition: CODEX_STRUCTURED_AGENT, adapter: native }]),
    logger: createStructuredAgentSessionLogger(),
    store,
    adapter: native,
    journalDatabase: openTestJournalHostDatabase(root),
    claimKeyId: 'key-1',
    mintSpawnToken: () => 'spawn-native',
    now: () => NOW
  })
  const attached = await host.attach(
    CALLER,
    hostTestAttachParams(null, {
      accountHome: { variable: 'CODEX_HOME', path: join(root, 'codex-home') },
      options: { accessMode: 'default' }
    })
  )
  expect(attached).toMatchObject({ ok: true })
})

afterEach(async () => {
  await host.flushAllStreamedEvents()
  closeTestJournalHostDatabase(root)
  await rm(root, { recursive: true, force: true })
})

async function pickLive(value: string) {
  const fields = { key: 'accessMode', value }
  return host.setOption(CALLER, { envelope: envelope(fields), ...fields })
}

describe('changing the access mode of a running child', () => {
  it('reaches the adapter only for a mode the adapter can switch to and the agent declares', async () => {
    expect(await pickLive('auto')).toMatchObject({ ok: true })
    expect(setOption).toHaveBeenCalledOnce()
    expect(setOption).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'accessMode', value: 'auto' })
    )
  })

  it('records the pick beside what the child reported, keeping the launch selections', async () => {
    await pickLive('auto')
    expect(store.getRecord(SESSION)?.options).toMatchObject({
      accessMode: 'auto',
      model: 'gpt-default'
    })
  })

  it.each([
    ['plan', 'the adapter offers it but Codex does not declare it'],
    ['full-access', 'the adapter does not offer it'],
    ['inherit', 'inherit is never a live switch']
  ])('refuses %s without invoking the adapter: %s', async (value) => {
    expect(await pickLive(value)).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_invalid' }
    })
    expect(setOption).not.toHaveBeenCalled()
  })

  it('advertises what may change live beside the legacy settable flag', async () => {
    const options = await host.readOptions(SESSION)
    expect(options.accessModeSupport).toEqual({
      modes: ['default', 'full-access'],
      presets: ['auto', 'read-only'],
      settable: false,
      liveModes: ['auto']
    })
  })
})
