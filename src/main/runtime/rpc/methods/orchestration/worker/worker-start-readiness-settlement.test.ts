import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../orchestration/preamble', () => ({ buildDispatchPreamble: () => 'preamble' }))
vi.mock('./worker-topology', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  monitorWorkerSetup: () => {}
}))

const { deliverAndSettleWorkerStartReadiness } = await import('./worker-start-readiness-settlement')

function settle(delivered: 'accepted' | undefined) {
  const db = {
    getWorkerDispatch: () => ({ state: 'starting' }),
    markWorkerStartUnknown: vi.fn(() => ({
      stage: 'turn_start_unobserved',
      residual_resources: '[]'
    })),
    markWorkerDispatchReady: vi.fn(() => ({ state: 'ready', stage: 'ready' }))
  }
  const host = {
    deps: { store: { getRecord: () => ({ lease: { runtimeFence: 1 } }) } },
    send: async () => ({
      ok: true,
      value: { clientMessageId: 'c1', submission: { dispatchState: 'pending', reason: null } }
    }),
    // undefined: the worker's agent was still starting when the wait ran out.
    waitForSendSettlement: async () =>
      delivered
        ? { value: { clientMessageId: 'c1', submission: { dispatchState: delivered } } }
        : undefined
  }
  const args = {
    runtime: {
      getNestedWorkerMaxDepth: () => 3,
      getTerminalOrchestrationCliCommand: () => 'orca'
    },
    db,
    run: { id: 'run_1' },
    task: { id: 't1', spec: 'do the thing' },
    dispatchId: 'd1',
    dispatchDepth: 0,
    structuredSession: { host, identity: { sessionId: 's1' } },
    terminalHandle: 'structured_worker_1',
    coordinatorHandle: 'term_c',
    devMode: undefined,
    requestId: 'r1',
    agent: 'claude',
    setupReceipt: {},
    launchReceipt: {},
    mode: {},
    timeoutMs: 60_000,
    effects: [],
    terminalRevealWarning: undefined,
    onStage: () => {}
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fakes implement exactly the runtime, db and host members this settlement reaches.
  const receipt = deliverAndSettleWorkerStartReadiness(args as never)
  return { db, receipt }
}

describe('a structured worker whose agent outlasts the preamble wait', () => {
  it('parks as start-unknown instead of failing the start, and never names a screen to read', async () => {
    const { db, receipt } = settle(undefined)

    // Resolving, not throwing, is what keeps the worker's session: a throw tears it down.
    await expect(receipt).resolves.toMatchObject({
      state: 'outcome_unknown',
      turnStart: 'unobserved',
      nextCommands: [
        'orca orchestration worker-show --dispatch d1 --json',
        'orca orchestration worker-abandon --dispatch d1 --json'
      ]
    })
    expect(db.markWorkerStartUnknown).toHaveBeenCalledWith(
      'd1',
      'turn_start_unobserved',
      expect.stringContaining('delivered when the agent starts'),
      expect.anything()
    )
    expect(db.markWorkerDispatchReady).not.toHaveBeenCalled()
  })

  it('is ready once the agent took the preamble within the wait', async () => {
    const { db, receipt } = settle('accepted')

    await expect(receipt).resolves.toMatchObject({ state: 'ready', turnStart: 'observed' })
    expect(db.markWorkerStartUnknown).not.toHaveBeenCalled()
  })
})

type FirstPromptResolver = NonNullable<
  Parameters<typeof deliverAndSettleWorkerStartReadiness>[0]['firstPrompt']
>

/** Runs delivery to a structured worker whose send is `send`; the captured sends are what reached the agent. */
function deliverWithFirstPrompt(
  firstPrompt: FirstPromptResolver | undefined,
  send: () => Promise<unknown>
) {
  const sent: unknown[] = []
  const db = {
    getWorkerDispatch: () => ({ state: 'starting' }),
    markWorkerStartUnknown: vi.fn(),
    markWorkerDispatchReady: vi.fn(() => ({ state: 'ready', stage: 'ready' }))
  }
  const host = {
    deps: { store: { getRecord: () => ({ lease: { runtimeFence: 1 } }) } },
    send: async (...params: unknown[]) => {
      sent.push(params)
      return send()
    },
    waitForSendSettlement: async () => ({
      value: { clientMessageId: 'c1', submission: { dispatchState: 'accepted' } }
    })
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fakes implement exactly the runtime, db and host members this settlement reaches.
  const receipt = deliverAndSettleWorkerStartReadiness({
    runtime: { getNestedWorkerMaxDepth: () => 3, getTerminalOrchestrationCliCommand: () => 'orca' },
    db,
    run: { id: 'run_1' },
    task: { id: 't1', spec: 'do the thing' },
    dispatchId: 'd1',
    dispatchDepth: 0,
    structuredSession: { host, identity: { sessionId: 's1' } },
    terminalHandle: 'structured_worker_1',
    coordinatorHandle: 'term_c',
    devMode: undefined,
    requestId: 'r1',
    agent: 'claude',
    launchedAgent: null,
    setupReceipt: {},
    launchReceipt: {},
    mode: {},
    timeoutMs: 60_000,
    effects: [],
    terminalRevealWarning: undefined,
    firstPrompt,
    onStage: () => {}
  } as never)
  return { receipt, sent }
}

describe('a delegated child whose first prompt asks for a prototype', () => {
  it('delivers the body with the hidden appendix after the preamble, resolved for the worker session', async () => {
    const resolver = vi.fn<FirstPromptResolver>(async () => ({
      body: 'do the thing',
      appendix: 'HIDDEN',
      discard: async () => undefined
    }))
    const { receipt, sent } = deliverWithFirstPrompt(resolver, async () => SENT_OK)
    await receipt
    expect(resolver).toHaveBeenCalledWith('s1')
    expect(JSON.stringify(sent)).toContain('"text":"preamble\\n\\nHIDDEN"')
  })

  it('removes the request folder when the delivery throws, and passes the error on', async () => {
    const discard = vi.fn(async () => undefined)
    const { receipt } = deliverWithFirstPrompt(
      async () => ({ body: 'do the thing', appendix: 'HIDDEN', discard }),
      async () => {
        throw new Error('the agent refused the preamble')
      }
    )
    await expect(receipt).rejects.toThrow('the agent refused the preamble')
    expect(discard).toHaveBeenCalledTimes(1)
  })

  it('keeps the request folder once the preamble is accepted', async () => {
    const discard = vi.fn(async () => undefined)
    const { receipt } = deliverWithFirstPrompt(
      async () => ({ body: 'do the thing', appendix: 'HIDDEN', discard }),
      async () => SENT_OK
    )
    await receipt
    expect(discard).not.toHaveBeenCalled()
  })

  it('delivers the task spec as stored when there is no first prompt', async () => {
    const { receipt, sent } = deliverWithFirstPrompt(undefined, async () => SENT_OK)
    await receipt
    expect(JSON.stringify(sent)).toContain('"text":"preamble"')
    expect(JSON.stringify(sent)).not.toContain('HIDDEN')
  })
})

const SENT_OK = {
  ok: true,
  value: { clientMessageId: 'c1', submission: { dispatchState: 'pending', reason: null } }
}
