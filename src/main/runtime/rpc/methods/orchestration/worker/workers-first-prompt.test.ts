import '../../../unused-default-rpc-methods.test-fixture'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseOrcaSessionAddress } from '../../../../../../shared/orca-session-address'
import { delegatedChildFirstPrompt } from '../../../../../delegated-session/delegated-child-first-prompt'
import { OrcaRuntimeService } from '../../../../orca-runtime'
import { OrchestrationDb } from '../../../../orchestration/db'
import type { OrchestrationSessionCaller } from '../../../../orchestration/orchestration-caller-identity'
import { ORCHESTRATION_METHODS } from '../../orchestration'
import { startLocalWorker } from './local-worker-start'

vi.mock('./local-worker-start', () => ({
  startLocalWorker: vi.fn(async () => ({ state: 'starting' }))
}))
vi.mock('../../../../../delegated-session/delegated-child-first-prompt', () => ({
  delegatedChildFirstPrompt: vi.fn(async () => null)
}))

const COORDINATOR_PANE_KEY = 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TASK_SPEC = 'Crea una pantalla de ajustes con tres propuestas'
const CHAT_SESSION_ID = parseOrcaSessionAddress('orca_session_id:chat_1')!
const CHAT_CALLER: OrchestrationSessionCaller = {
  address: 'orca_session_id:chat_1',
  terminalHandle: 'term_coord',
  paneKey: COORDINATOR_PANE_KEY,
  orcaSessionId: CHAT_SESSION_ID,
  sessionId: CHAT_SESSION_ID,
  workspaceId: 'wt'
}

describe('orchestration.workerStart first prompt', () => {
  let db: OrchestrationDb
  let runtime: OrcaRuntimeService
  let runId: string

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    runtime = new OrcaRuntimeService()
    runtime.setOrchestrationDb(db)
    runId = db.createRun({
      objective: 'Start a child over the CLI',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: COORDINATOR_PANE_KEY
    }).id
    vi.spyOn(runtime, 'getTerminalPaneKey').mockImplementation((handle) =>
      handle === 'term_coord' ? COORDINATOR_PANE_KEY : null
    )
    vi.mocked(startLocalWorker).mockClear()
    vi.mocked(delegatedChildFirstPrompt).mockClear()
  })

  afterEach(() => db.close())

  async function startWorker(caller: { orchestrationCaller?: OrchestrationSessionCaller }) {
    const task = db.createTask({ spec: TASK_SPEC, runId })
    const method = ORCHESTRATION_METHODS.find(
      (candidate) => candidate.name === 'orchestration.workerStart'
    )
    if (!method) {
      throw new Error('workerStart method is not registered')
    }
    const params = method.params!.parse({
      task: task.id,
      from: 'term_coord',
      worktree: 'current',
      agent: 'pi'
    })
    await method.handler(params, { runtime, ...caller })
  }

  function lastStartArgs() {
    const args = vi.mocked(startLocalWorker).mock.calls.at(-1)?.[0]
    if (!args) {
      throw new Error('startLocalWorker was not called')
    }
    return args
  }

  it('gives a child that a structured chat starts over the CLI the first prompt, from that chat', async () => {
    await startWorker({ orchestrationCaller: CHAT_CALLER })
    const { firstPrompt } = lastStartArgs()
    expect(firstPrompt).toBeTypeOf('function')
    await firstPrompt?.('child-session')
    expect(delegatedChildFirstPrompt).toHaveBeenCalledWith(
      {
        childSessionId: 'child-session',
        originSessionId: CHAT_CALLER.sessionId,
        taskSpec: TASK_SPEC
      },
      expect.anything()
    )
  })

  it('gives no first prompt to a child a terminal coordinator starts', async () => {
    await startWorker({})
    expect(lastStartArgs().firstPrompt).toBeUndefined()
  })
})
