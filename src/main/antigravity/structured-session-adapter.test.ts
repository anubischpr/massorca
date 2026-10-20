import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import {
  openProviderTimelineRig,
  closeProviderTimelineRigs
} from '../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'
import { AgentSessionOptionRejectedError } from '../native-chat/agent-session-wire/structured-agent-session-option-error'
import {
  AgentSessionAcquisitionExitUnprovenError,
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

async function createHarness(
  processlessTiming?: ProcesslessTiming,
  launchEnv?: Record<string, string>
) {
  const rig = await openProviderTimelineRig({ agent: 'antigravity', sessionId: 'session-timeline' })
  const processes: ReturnType<typeof antigravityTestProcess>[] = []
  const settled = vi.fn(),
    lifecycle = vi.fn(),
    childWork = vi.fn()
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
  const resolveLaunch = vi.fn(async () => ({
    command: 'agy',
    args: [],
    previous: null,
    ...(launchEnv ? { env: launchEnv } : {})
  }))
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
    onChildWorkEvidence: childWork,
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
  return { adapter, processes, settled, lifecycle, childWork, input, send, resolveLaunch }
}

async function setup() {
  const harness = await createHarness()
  const acquired = await harness.adapter.acquire(harness.input)
  return { ...harness, acquired }
}

it('preserves the provider diagnostic on an unexpected exit without guessing its cause', async () => {
  const h = await setup()
  h.processes[0].managed.stderrTail = () =>
    'The selected model is unavailable. Choose another model.'
  h.processes[0].exit()
  await h.adapter.drainObservedExits()
  expect(h.lifecycle).toHaveBeenCalledWith(
    expect.objectContaining({
      cause: 'unexpected-exit',
      failure: {
        kind: 'providerExited',
        detail: {
          text: 'The selected model is unavailable. Choose another model.',
          audience: 'person'
        }
      }
    })
  )
})

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

it('publishes an agy subagent from its invoke_subagent step and settles it when the turn ends', async () => {
  const h = await setup()
  expect(await h.send('message-1')).toEqual({ state: 'admitted' })
  h.processes[0].echo()
  h.processes[0].emit({
    event: 'step_update',
    step_update: {
      conversation_id: 'conversation-1',
      step_index: 2,
      state: 'ACTIVE',
      step_type: 'tool',
      tool_name: 'invoke_subagent',
      tool_info: { parameters: { Role: 'research worker', TypeName: 'research' } }
    }
  })
  const handle = { idKind: 'task_id', id: 'antigravity:conversation-1:subagent:2' }
  expect(h.childWork).toHaveBeenLastCalledWith('session-timeline', [
    expect.objectContaining({
      type: 'live',
      child: expect.objectContaining({
        handle,
        kind: 'agent',
        residency: 'background',
        state: 'working',
        agentType: 'research'
      })
    })
  ])
  h.processes[0].result()
  expect(h.childWork).toHaveBeenLastCalledWith('session-timeline', [
    expect.objectContaining({ type: 'ended', handle, outcome: 'unknown' })
  ])
})

it('ends an agy subagent still open as its session ends when the process exits', async () => {
  const h = await setup()
  expect(await h.send('message-1')).toEqual({ state: 'admitted' })
  h.processes[0].echo()
  h.processes[0].emit({
    event: 'step_update',
    step_update: {
      conversation_id: 'conversation-1',
      step_index: 2,
      state: 'ACTIVE',
      step_type: 'tool',
      tool_name: 'invoke_subagent',
      tool_info: { parameters: {} }
    }
  })
  h.processes[0].exit()
  expect(h.childWork).toHaveBeenLastCalledWith('session-timeline', [
    { type: 'session-ended', observedAt: expect.any(Number) }
  ])
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

it('records a live model pick for the next start without respawning, and reports it as current', async () => {
  const h = await setup()
  await expect(
    h.adapter.setOption({ sessionId: 'session-timeline', fence: 7, key: 'model', value: 'other' })
  ).resolves.toEqual({ model: 'other', effort: 'high' })
  await expect(h.adapter.readOptions({ sessionId: 'session-timeline', fence: 7 })).resolves.toEqual(
    {
      models: [],
      current: { model: 'other', effort: 'high' }
    }
  )
  expect(h.processes).toHaveLength(1)
  expect(await h.adapter.closeSession('session-timeline')).toBe(true)
  h.adapter.acknowledgeSessionRelease('session-timeline')
  await h.adapter.acquire({ ...h.input, options: { model: 'other', effort: 'high' } })
  expect(h.resolveLaunch).toHaveBeenLastCalledWith(h.input.identity, {
    model: 'other',
    effort: 'high'
  })
  expect(h.processes).toHaveLength(2)
})

it('refuses an effort agy does not launch with and an unknown option, leaving the child and its values alone', async () => {
  const h = await setup()
  await expect(
    h.adapter.setOption({
      sessionId: 'session-timeline',
      fence: 7,
      key: 'effort',
      value: 'maximum'
    })
  ).rejects.toBeInstanceOf(AgentSessionOptionRejectedError)
  await expect(
    h.adapter.setOption({ sessionId: 'session-timeline', fence: 7, key: 'fastMode', value: 'true' })
  ).rejects.toBeInstanceOf(AgentSessionOptionRejectedError)
  expect(h.processes).toHaveLength(1)
  expect(h.adapter.readAcquisitionOptions({ sessionId: 'session-timeline', fence: 7 })).toEqual(
    h.input.options
  )
  await expect(h.adapter.readOptions({ sessionId: 'session-timeline', fence: 7 })).resolves.toEqual(
    {
      models: [],
      current: { model: 'model-id', effort: 'high' }
    }
  )
})

it('publishes the MCP servers agy configures under the launch home with its options', async () => {
  const home = await mkdtemp(join(tmpdir(), 'agy-adapter-home-'))
  cleanups.push(() => rm(home, { recursive: true, force: true }))
  await mkdir(join(home, '.gemini', 'config'), { recursive: true })
  await writeFile(
    join(home, '.gemini', 'config', 'mcp_config.json'),
    JSON.stringify({ mcpServers: { codegraph: { command: 'codegraph', disabled: false } } })
  )
  const h = await createHarness(undefined, { HOME: home })
  await h.adapter.acquire(h.input)
  await expect(h.adapter.readOptions({ sessionId: 'session-timeline', fence: 7 })).resolves.toEqual(
    {
      models: [],
      current: { model: 'model-id', effort: 'high' },
      connectors: {
        observedAt: expect.any(Number),
        servers: [{ name: 'codegraph', status: 'unknown', configured: true }]
      }
    }
  )
})

it('starts a new child once the previous child exit is observed, without the host acknowledging it', async () => {
  const h = await setup()
  h.processes[0].exit()
  await expect(h.adapter.acquire(h.input)).resolves.toBeDefined()
  expect(h.processes).toHaveLength(2)
})

it('refuses a new child while the previous one still runs, as an unproven exit', async () => {
  const h = await setup()
  await expect(h.adapter.acquire(h.input)).rejects.toBeInstanceOf(
    AgentSessionAcquisitionExitUnprovenError
  )
  expect(h.processes).toHaveLength(1)
})

it('takes access picks at the next start and reads the catalog only for a live child', async () => {
  const h = await setup()
  expect(h.adapter.takesAccessAtNextStart('session-timeline')).toBe(true)
  expect(h.adapter.modelsFromRestingCatalog('session-timeline')).toBe(true)
  expect(h.adapter.takesAccessAtNextStart('unknown-session')).toBe(false)
  expect(h.adapter.modelsFromRestingCatalog('unknown-session')).toBe(false)
})

it('advertises only supported stream capabilities and refuses stale dispatch fences', async () => {
  expect(ANTIGRAVITY_STRUCTURED_AGENT.capabilities).toEqual({
    rewind: false,
    compact: false,
    threadGoal: false,
    contextUsage: true,
    imagePrompts: false,
    steering: 'queue',
    approvalEnforcement: 'provider',
    supportedAccessModes: ['default', 'full-access'],
    supportedPermissionPresets: ['auto', 'accept-edits', 'plan']
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

it('cancels through managed close without requiring descendant release proof', async () => {
  const h = await setup()
  const process = h.processes[0]
  const terminate = vi.fn(async () => null)
  process.managed.terminateTree = terminate
  process.managed.close = vi.fn(async () => {
    process.exit()
    return { root: 'exited', tree: null } as const
  })
  await h.send('cancel-managed')
  expect(await h.adapter.cancelTurn({ sessionId: 'session-timeline', fence: 7 })).toEqual({
    cancelled: true
  })
  expect(process.managed.close).toHaveBeenCalled()
  expect(terminate).not.toHaveBeenCalled()
  expect(process.managed.rootExitObserved).toBe(true)
  await expect(h.adapter.releaseAcquisition({ sessionId: 'session-timeline' })).rejects.toThrow(
    'Antigravity root exit observed'
  )
  h.adapter.acknowledgeSessionRelease('session-timeline')
})

it('does not acknowledge cancellation when managed close cannot observe root exit', async () => {
  const h = await setup()
  const process = h.processes[0]
  process.managed.close = vi.fn(async () => ({ root: 'live', tree: 'unverifiable' }) as const)
  await h.send('cancel-unproven')
  expect(await h.adapter.cancelTurn({ sessionId: 'session-timeline', fence: 7 })).toEqual({
    cancelled: false
  })
  expect(process.managed.rootExitObserved).toBe(false)
})

it('rejects live access widening without starting another child', async () => {
  const h = await setup()
  await expect(
    h.adapter.setOption({
      sessionId: 'session-timeline',
      fence: 7,
      key: 'accessMode',
      value: 'full-access'
    })
  ).rejects.toBeInstanceOf(AgentSessionOptionRejectedError)
  expect(h.processes).toHaveLength(1)
  expect(h.adapter.readAcquisitionOptions({ sessionId: 'session-timeline', fence: 7 })).toEqual(
    h.input.options
  )
})
