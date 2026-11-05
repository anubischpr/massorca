import '../../../unused-default-rpc-methods.test-fixture'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseOrcaSessionAddress } from '../../../../../../shared/orca-session-address'
import { OrcaRuntimeService } from '../../../../orca-runtime'
import { OrchestrationDb } from '../../../../orchestration/db'
import type { OrchestrationSessionCaller } from '../../../../orchestration/orchestration-caller-identity'
import { ORCHESTRATION_METHODS } from '../../orchestration'
import { placeWorkerAgent } from './worker-start-agent-placement'

// Placement is where a start leaves the depth fence behind: stopping it there keeps the test on the
// dispatch row the fence stamps, with no terminal or chat to launch.
vi.mock('./worker-start-agent-placement', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  placeWorkerAgent: vi.fn(async () => {
    throw new Error('placement stopped')
  })
}))
const hostRef = vi.hoisted((): { current: unknown } => ({ current: null }))
vi.mock('../../../../../native-chat/agent-session-wire/structured-agent-session-registry', () => ({
  getStructuredAgentSessionHost: () => hostRef.current
}))

const BOT_SESSION = parseOrcaSessionAddress('orca_session_id:bot_chat')!
const BOT_CHILD_SESSION = parseOrcaSessionAddress('orca_session_id:bot_child_chat')!
const PLAIN_SESSION = parseOrcaSessionAddress('orca_session_id:plain_chat')!
const addressOf = (id: typeof BOT_SESSION): string => `orca_session_id:${id}`
const sessionCaller = (id: typeof BOT_SESSION): OrchestrationSessionCaller => ({
  address: addressOf(id),
  terminalHandle: null,
  paneKey: null,
  orcaSessionId: id,
  sessionId: id,
  workspaceId: 'wt'
})

describe('orchestration.workerStart nesting depth for a bot run', () => {
  let db: OrchestrationDb
  let runtime: OrcaRuntimeService
  let bot: { botId: string; teamId: string }

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    runtime = new OrcaRuntimeService()
    runtime.setOrchestrationDb(db)
    vi.spyOn(runtime, 'validateOrchestrationAgentLauncher').mockImplementation(() => {})
    vi.spyOn(runtime, 'showManagedTerminalWorkspace').mockResolvedValue({
      id: 'repo::worktree'
    } as never)
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Cristhofer', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Design',
      prompt: 'Design',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, BOT_SESSION)
    bot = { botId: team.bots[0].id, teamId: team.id }
    vi.mocked(placeWorkerAgent).mockClear()
  })

  afterEach(() => {
    hostRef.current = null
    db.close()
  })

  /** A session that is itself a worker: it holds a live dispatch at `depth`. */
  function holdAtDepth(session: typeof BOT_SESSION, parent: typeof BOT_SESSION | null): number {
    const seed = db.createTask({
      runId: 'run_legacy_local',
      spec: 'The work this session was handed'
    })
    return db.createDispatchContext({
      taskId: seed.id,
      assigneeHandle: addressOf(session),
      creator: parent ? { kind: 'session', orcaSessionId: parent } : { kind: 'system' },
      maxDepth: 9
    }).depth
  }

  async function requestChild(session: typeof BOT_SESSION) {
    const caller = sessionCaller(session)
    const run = db.createRun({
      objective: 'Child sessions',
      coordinatorHandle: null,
      coordinatorPaneKey: null,
      coordinatorOrcaSessionId: session
    })
    const task = db.createTask({ spec: 'Create a new design', runId: run.id })
    const method = ORCHESTRATION_METHODS.find((entry) => entry.name === 'orchestration.workerStart')
    if (!method) {
      throw new Error('workerStart method is not registered')
    }
    const params = method.params!.parse({
      task: task.id,
      from: caller.address,
      worktree: 'current',
      agent: 'pi'
    })
    return method.handler(params, { runtime, orchestrationCaller: caller })
  }

  const childDepths = (): number[] =>
    db.db
      .prepare(`SELECT depth FROM dispatch_contexts WHERE creator_orca_session_id IS NOT NULL`)
      .all()
      .map((row) => (row as { depth: number }).depth)

  it('opens a child for a room bot that was itself handed over, at depth 2', async () => {
    expect(holdAtDepth(BOT_SESSION, null)).toBe(1)
    await requestChild(BOT_SESSION)
    expect(childDepths()).toEqual([2])
  })

  it('refuses a non-bot session at the same depth, with the same words as before', async () => {
    expect(holdAtDepth(PLAIN_SESSION, null)).toBe(1)
    await expect(requestChild(PLAIN_SESSION)).rejects.toMatchObject({
      code: 'nested_worker_depth_exceeded',
      message:
        'Sub-worker dispatch is not permitted at depth 2 (max 1). Complete this task yourself.'
    })
    expect(childDepths()).toEqual([])
  })

  it('gives a bot only one extra level: its child cannot open a child of its own', async () => {
    holdAtDepth(BOT_SESSION, null)
    expect(holdAtDepth(BOT_CHILD_SESSION, BOT_SESSION)).toBe(2)
    hostRef.current = {
      deps: {
        store: {
          getRecord: (id: string) =>
            id === BOT_CHILD_SESSION
              ? { options: { botTeamBotId: bot.botId, botTeamId: bot.teamId } }
              : undefined
        }
      }
    }
    await expect(requestChild(BOT_CHILD_SESSION)).rejects.toMatchObject({
      code: 'nested_worker_depth_exceeded',
      message:
        'Sub-worker dispatch is not permitted at depth 3 (max 2). Complete this task yourself.'
    })
  })

  it('hands the bot to the placement, so the extra-level child keeps the bot-run marker', async () => {
    holdAtDepth(BOT_SESSION, null)
    await requestChild(BOT_SESSION)
    expect(vi.mocked(placeWorkerAgent).mock.calls.at(-1)?.[0].botRun).toEqual(bot)
  })
})
