import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
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

type Rig = {
  root: string
  store: AgentSessionRecordStore
  host: StructuredAgentSessionHost
  setOption: Mock<StructuredAgentSessionAdapter['setOption']>
}
let rig: Rig | null = null

/** A Codex-shaped chat whose child is running, started from `accessMode` (absent = `inherit`)
 *  while the global setting resolves to full access or not (absent = unknown to the host). */
async function runningChat(input: {
  accessMode?: string
  inheritedFullAccess?: boolean
  liveModes?: readonly ('default' | 'auto' | 'plan' | 'full-access')[]
  takesNextStart?: boolean
}): Promise<Rig> {
  const root = await mkdtemp(join(tmpdir(), 'orca-record-only-access-'))
  resetHostTestOperationIds()
  const store = await openTestAgentSessionRecordStore(root)
  const setOption = vi.fn<StructuredAgentSessionAdapter['setOption']>(async () => ({}))
  const native: StructuredAgentSessionAdapter = {
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
    readOptions: vi.fn(async () => ({ current: {}, models: [] })),
    liveAccessModes: () => input.liveModes ?? ['auto'],
    takesAccessAtNextStart: () => input.takesNextStart === true,
    closeSession: vi.fn(async () => true),
    rewind: vi.fn(),
    recoverRewind: vi.fn(),
    compact: vi.fn(),
    changeThreadGoal: vi.fn()
  }
  const host = new StructuredAgentSessionHost({
    agents: new StructuredAgentRegistry([{ definition: CODEX_STRUCTURED_AGENT, adapter: native }]),
    logger: createStructuredAgentSessionLogger(),
    store,
    adapter: native,
    journalDatabase: openTestJournalHostDatabase(root),
    claimKeyId: 'key-1',
    mintSpawnToken: () => 'spawn-native',
    now: () => NOW,
    ...(input.inheritedFullAccess === undefined
      ? {}
      : { resolveInheritedFullAccess: () => input.inheritedFullAccess === true })
  })
  const attached = await host.attach(
    CALLER,
    hostTestAttachParams(null, {
      accountHome: { variable: 'CODEX_HOME', path: join(root, 'codex-home') },
      ...(input.accessMode ? { options: { accessMode: input.accessMode } } : {})
    })
  )
  expect(attached).toMatchObject({ ok: true })
  rig = { root, store, host, setOption }
  return rig
}

afterEach(async () => {
  if (rig) {
    await rig.host.flushAllStreamedEvents()
    closeTestJournalHostDatabase(rig.root)
    await rm(rig.root, { recursive: true, force: true })
    rig = null
  }
})

function envelopeFor(current: Rig, fields: Record<string, unknown>): AgentSessionMutationEnvelope {
  return {
    sessionId: SESSION,
    clientOperationId: hostTestOperationId(),
    expectedRuntimeFence: current.store.getRecord(SESSION)?.lease.runtimeFence ?? null,
    payloadFingerprint: computeAgentSessionPayloadFingerprint({
      method: 'agentSession.setOption',
      sessionId: SESSION,
      fields
    })
  }
}

function pick(current: Rig, value: string) {
  const fields = { key: 'accessMode', value }
  return current.host.setOption(CALLER, { envelope: envelopeFor(current, fields), ...fields })
}

const recorded = (current: Rig) => current.store.getRecord(SESSION)?.options?.accessMode

describe('picking an access mode the running child already satisfies', () => {
  it('pins Full access over Inherit when Inherit resolves to full access, without touching the child', async () => {
    const chat = await runningChat({ inheritedFullAccess: true })
    expect((await chat.host.readOptions(SESSION)).accessModeSupport).toMatchObject({
      recordOnlyModes: ['full-access']
    })

    expect(await pick(chat, 'full-access')).toMatchObject({ ok: true })

    expect(recorded(chat)).toBe('full-access')
    expect(chat.setOption).not.toHaveBeenCalled()
  })

  it('returns to Inherit when Inherit still resolves to full access, again leaving the child alone', async () => {
    const chat = await runningChat({ accessMode: 'full-access', inheritedFullAccess: true })

    expect(await pick(chat, 'inherit')).toMatchObject({ ok: true })

    expect(recorded(chat)).toBe('inherit')
    expect(chat.setOption).not.toHaveBeenCalled()
  })

  it('refuses Inherit over Full access once Inherit resolves to something narrower', async () => {
    const chat = await runningChat({ accessMode: 'full-access', inheritedFullAccess: false })

    expect(await pick(chat, 'inherit')).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_invalid' }
    })
    expect(recorded(chat)).toBe('full-access')
    expect(chat.setOption).not.toHaveBeenCalled()
  })

  it('never widens: Full access stays start-only while Inherit resolves to ask for approval', async () => {
    const chat = await runningChat({ inheritedFullAccess: false })

    expect(await pick(chat, 'full-access')).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_invalid' }
    })
    expect(chat.setOption).not.toHaveBeenCalled()
    expect((await chat.host.readOptions(SESSION)).accessModeSupport?.recordOnlyModes).toEqual([
      'default'
    ])
  })

  it('pins Ask for approval over Inherit when Inherit resolves to it', async () => {
    const chat = await runningChat({ inheritedFullAccess: false })

    expect(await pick(chat, 'default')).toMatchObject({ ok: true })

    expect(recorded(chat)).toBe('default')
    expect(chat.setOption).not.toHaveBeenCalled()
  })

  it('does not let a live narrowing be undone: a child switched to Auto is never re-widened', async () => {
    const chat = await runningChat({ accessMode: 'full-access', inheritedFullAccess: true })
    expect(await pick(chat, 'auto')).toMatchObject({ ok: true })
    expect(chat.setOption).toHaveBeenCalledOnce()

    expect(await pick(chat, 'full-access')).toMatchObject({ ok: false })
    expect(await pick(chat, 'inherit')).toMatchObject({ ok: false })
    expect(recorded(chat)).toBe('auto')
  })

  it('takes no record-only pick when the host cannot say what Inherit resolves to', async () => {
    const chat = await runningChat({})

    expect(await pick(chat, 'full-access')).toMatchObject({ ok: false })
    expect(
      (await chat.host.readOptions(SESSION)).accessModeSupport?.recordOnlyModes
    ).toBeUndefined()
  })
})

describe('picking an access mode a running child takes at its next start', () => {
  it('records the pick for the next start and leaves the running child alone', async () => {
    const chat = await runningChat({ accessMode: 'default', liveModes: [], takesNextStart: true })
    expect((await chat.host.readOptions(SESSION)).accessModeSupport).toMatchObject({
      settable: false,
      recordOnlyModes: expect.arrayContaining(['full-access']),
      nextStartModes: expect.arrayContaining(['full-access'])
    })

    expect(await pick(chat, 'full-access')).toMatchObject({ ok: true })

    expect(recorded(chat)).toBe('full-access')
    expect(chat.setOption).not.toHaveBeenCalled()
  })

  it('still refuses a mode the agent does not declare', async () => {
    const chat = await runningChat({ accessMode: 'default', liveModes: [], takesNextStart: true })

    expect(await pick(chat, 'not-a-mode')).toMatchObject({ ok: false })
    expect(recorded(chat)).toBe('default')
  })

  it('reports no next-start picks, and refuses a widening, when the child cannot take them at its start', async () => {
    const chat = await runningChat({ accessMode: 'default', liveModes: [] })

    expect((await chat.host.readOptions(SESSION)).accessModeSupport?.nextStartModes).toBeUndefined()
    expect(await pick(chat, 'full-access')).toMatchObject({ ok: false })
    expect(recorded(chat)).toBe('default')
  })
})
