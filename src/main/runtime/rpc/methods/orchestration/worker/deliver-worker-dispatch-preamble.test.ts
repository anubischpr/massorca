import { describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../../../orchestration/db'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import { deliverWorkerDispatchPreamble } from './deliver-worker-dispatch-preamble'

const sent = vi.hoisted((): { preambles: string[] } => ({ preambles: [] }))
vi.mock('../../orchestration-structured-worker-session', () => ({
  sendStructuredWorkerPreamble: async (args: { preamble: string }) => {
    sent.preambles.push(args.preamble)
    return 'accepted'
  }
}))

const CHAT_SESSION = '4a1f6c2e-8b3d-4e7a-9c15-0d2b6e8f1a37'
const db = new OrchestrationDb(':memory:')

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: delivery reads only the members this fake implements; the send is mocked.
const runtime = {
  getNestedWorkerMaxDepth: () => 2,
  getTerminalOrchestrationCliCommand: () => 'orca'
} as unknown as OrcaRuntimeService

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mocked send ignores host; delivery reads only identity.sessionId.
const structuredSession = {
  host: {},
  identity: { sessionId: CHAT_SESSION, agent: 'codex' }
} as unknown as Parameters<typeof deliverWorkerDispatchPreamble>[0]['structuredSession']

function deliver(appendix?: string) {
  return deliverWorkerDispatchPreamble({
    runtime,
    db,
    structuredSession,
    terminalHandle: 'structworker_1',
    dispatchId: 'ctx_1',
    dispatchDepth: 1,
    runId: 'run_1',
    taskId: 'task_1',
    taskSpec: 'do the thing',
    coordinatorHandle: 'term_coord',
    devMode: false,
    requestId: 'req_1',
    ...(appendix !== undefined ? { appendix } : {})
  })
}

describe('deliverWorkerDispatchPreamble with a first-prompt appendix', () => {
  it('sends the appendix after the preamble, so it sits outside the task body', async () => {
    sent.preambles = []
    await deliver('Hidden prototype instruction.')
    const [delivered] = sent.preambles
    expect(delivered).toBeDefined()
    expect(delivered?.endsWith('\n\nHidden prototype instruction.')).toBe(true)
    expect(delivered).toContain('do the thing')
    expect(delivered?.indexOf('do the thing')).toBeLessThan(
      delivered?.indexOf('Hidden prototype instruction.') ?? -1
    )
  })

  it('sends the preamble unchanged when there is no appendix', async () => {
    sent.preambles = []
    await deliver()
    await deliver('')
    const [plain, empty] = sent.preambles
    expect(plain).toBeDefined()
    expect(plain).not.toContain('Hidden prototype instruction.')
    expect(empty).toBe(plain)
  })
})
