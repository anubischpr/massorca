import { afterEach, expect, it, vi } from 'vitest'
import {
  openProviderTimelineRig,
  closeProviderTimelineRigs
} from '../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'
import { AgentSessionOptionRejectedError } from '../native-chat/agent-session-wire/structured-agent-session-option-error'
import {
  AgentSessionPreSpawnError,
  type StructuredAgentSessionAcquireInput
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { AntigravityStructuredSessionAdapter } from './structured-session-adapter'
import { antigravityTestProcess } from './structured-session-test-process'
import { ANTIGRAVITY_STRUCTURED_AGENT } from './structured-agent-definition'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup()
  }
  await closeProviderTimelineRigs()
})
type ProcesslessTiming = 'before-cleanup' | 'after-cleanup-start'

async function createHarness(processlessTiming?: ProcesslessTiming) {
  const rig = await openProviderTimelineRig({ agent: 'antigravity', sessionId: 'session-timeline' })
  const processes: ReturnType<typeof antigravityTestProcess>[] = []
  const settled = vi.fn(),
    lifecycle = vi.fn()
  const input: StructuredAgentSessionAcquireInput = {
    identity: {
      sessionId: 'session-timeline',
      workspaceId: 'folder',
      hostId: 'local',
      agent: 'antigravity',
      providerHandle: null
    },
    fence: 7,
    spawnToken: 'spawn',
    events: rig.eventSink,
    options: { model: 'model-id', effort: 'high' }
  }
  const resolveLaunch = vi.fn(async () => ({ command: 'agy', args: [], previous: null }))
  const adapter = new AntigravityStructuredSessionAdapter({
    resolveLaunch,
    readProcessStartTime: async () => 100,
    processFactory: () => {
      const process = antigravityTestProcess(
        'conversation-1',
        processlessTiming ? { processlessTiming } : {}
      )
      processes.push(process)
      if (processlessTiming === 'before-cleanup') {
        process.failSpawn()
      } else if (!processlessTiming) {
        process.initialize()
      }
      return process.managed
    },
    onLifecycle: lifecycle,
    onSettled: settled,
    onIdle: vi.fn(),
    logger: { warn: vi.fn(), error: vi.fn() }
  })
  cleanups.push(async () => {
    if (!processlessTiming) {
      await adapter.closeAll()
    }
    await adapter.drainObservedExits()
    adapter.acknowledgeSessionRelease('session-timeline')
  })
  const send = (id: string) =>
    adapter.dispatch({
      sessionId: 'session-timeline',
      fence: 7,
      clientMessageId: id,
      requestedAt: 123,
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'question' }] }
    })
  return { adapter, processes, settled, lifecycle, input, send, resolveLaunch }
}

async function setup() {
  const harness = await createHarness()
  const acquired = await harness.adapter.acquire(harness.input)
  return { ...harness, acquired }
}

it('classifies a processless close observed before acquisition cleanup', async () => {
  const h = await createHarness('before-cleanup')
  await expect(h.adapter.acquire(h.input)).rejects.toBeInstanceOf(AgentSessionPreSpawnError)
  expect(h.processes[0].managed.processless).toBe(true)
  expect(h.processes[0].managed.rootExitObserved).toBe(false)
  await expect(h.adapter.closeSession('session-timeline')).rejects.toBeInstanceOf(
    AgentSessionPreSpawnError
  )
})

it('waits for processless close observed after acquisition cleanup starts', async () => {
  const h = await createHarness('after-cleanup-start')
  await expect(h.adapter.acquire(h.input)).rejects.toBeInstanceOf(AgentSessionPreSpawnError)
  expect(h.processes[0].events.indexOf('processless-close')).toBeGreaterThan(
    h.processes[0].events.indexOf('terminate')
  )
  expect(h.processes[0].managed.processless).toBe(true)
  expect(h.processes[0].managed.rootExitObserved).toBe(false)
  await expect(h.adapter.closeSession('session-timeline')).rejects.toBeInstanceOf(
    AgentSessionPreSpawnError
  )
})

it('acquires only a validated init and settles dispatch only after its user-input echo', async () => {
  const h = await setup()
  expect(h.acquired.link.handle).toEqual({
    transport: 'antigravity-stream-json',
    agent: 'antigravity',
    nativeId: 'conversation-1'
  })
  expect(h.acquired.process).toMatchObject({
    pid: 1234,
    processStartTimeMs: 100,
    spawnToken: 'spawn'
  })
  expect(await h.send('message-1')).toEqual({ state: 'admitted' })
  expect(h.settled).not.toHaveBeenCalled()
  h.processes[0].echo()
  expect(h.settled).toHaveBeenCalledWith(
    expect.objectContaining({
      clientMessageId: 'message-1',
      outcome: {
        state: 'accepted',
        providerIdentity: { provider: 'orca', clientMessageId: 'message-1' }
      }
    })
  )
  h.processes[0].result('WAITING')
  expect(h.adapter.holdsDispatch('session-timeline')).toBe(true)
  h.processes[0].result()
  expect(h.adapter.holdsDispatch('session-timeline')).toBe(false)
})

it('serializes follow-ups and keeps an echoed but not yet running prompt stoppable', async () => {
  const h = await setup()
  await h.send('first')
  await h.send('second')
  expect(h.processes[0].written).toHaveLength(1)
  h.processes[0].echo()
  expect(await h.adapter.cancelTurn({ sessionId: 'session-timeline', fence: 7 })).toEqual({
    cancelled: true
  })
  expect(h.processes[0].managed.rootVerdict).toBe('exited')
  expect(h.adapter.stopEndsSession()).toBe(true)
  expect(h.lifecycle).toHaveBeenCalledWith(expect.objectContaining({ cause: 'requested-close' }))
})

it('rejects live options without respawning and releases proven-dead acquisitions', async () => {
  const h = await setup()
  await expect(
    h.adapter.setOption({ sessionId: 'session-timeline', fence: 7, key: 'model', value: 'other' })
  ).rejects.toBeInstanceOf(AgentSessionOptionRejectedError)
  expect(h.processes).toHaveLength(1)
  expect(await h.adapter.closeSession('session-timeline')).toBe(true)
  h.adapter.acknowledgeSessionRelease('session-timeline')
  await h.adapter.acquire(h.input)
  expect(h.resolveLaunch).toHaveBeenCalledTimes(2)
  expect(h.processes).toHaveLength(2)
})

it('advertises only supported stream capabilities and refuses stale dispatch fences', async () => {
  expect(ANTIGRAVITY_STRUCTURED_AGENT.capabilities).toEqual({
    rewind: false,
    compact: false,
    threadGoal: false,
    contextUsage: false,
    imagePrompts: false,
    steering: 'queue',
    approvalEnforcement: 'provider'
  })
  const h = await setup()
  await expect(
    h.adapter.dispatch({
      sessionId: 'session-timeline',
      fence: 6,
      clientMessageId: 'stale',
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'question' }] }
    })
  ).rejects.toThrow('not live under this fence')
  expect(h.processes[0].written).toEqual([])
})
