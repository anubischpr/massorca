import '../../../unused-default-rpc-methods.test-fixture'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseOrcaSessionAddress } from '../../../../../../shared/orca-session-address'
import { OrcaRuntimeService } from '../../../../orca-runtime'
import { OrchestrationDb } from '../../../../orchestration/db'
import type { OrchestrationSessionCaller } from '../../../../orchestration/orchestration-caller-identity'
import { ORCHESTRATION_METHODS } from '../../orchestration'
import { startFederatedWorker } from '../federation/federated-worker-start'
import { startLocalWorker } from './local-worker-start'
import { refuseDeniedBotCaller } from './worker-bot-run'
import {
  SESSION_X,
  SESSION_Y,
  sessionRecord
} from '../../../orchestration-session-caller-test-fixture'

vi.mock('./local-worker-start', () => ({
  startLocalWorker: vi.fn(async () => ({ state: 'starting' }))
}))
vi.mock('../federation/federated-worker-start', () => ({
  startFederatedWorker: vi.fn(async () => ({ state: 'starting' }))
}))
const hostRef = vi.hoisted((): { current: unknown } => ({ current: null }))
vi.mock('../../../../../native-chat/agent-session-wire/structured-agent-session-registry', () => ({
  getStructuredAgentSessionHost: () => hostRef.current
}))
const denial = vi.hoisted(() => ({ denies: false }))
vi.mock('../../../../../marketplace/marketplace-bot-run-denial', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveBotRunDenial: async () =>
    denial.denies ? { mcpServers: ['engram'], envNames: [], envPrefixes: [] } : null
}))

const PANE_KEY = 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BOT_SESSION = parseOrcaSessionAddress('orca_session_id:bot_chat')!
const PLAIN_SESSION = parseOrcaSessionAddress('orca_session_id:plain_chat')!
const callerFor = (id: typeof BOT_SESSION, address: string): OrchestrationSessionCaller => ({
  address,
  terminalHandle: 'term_coord',
  paneKey: PANE_KEY,
  orcaSessionId: id,
  sessionId: id,
  workspaceId: 'wt'
})
const BOT_CALLER = callerFor(BOT_SESSION, 'orca_session_id:bot_chat')
const PLAIN_CALLER = callerFor(PLAIN_SESSION, 'orca_session_id:plain_chat')

describe('orchestration.workerStart from a session that belongs to a bot run', () => {
  let db: OrchestrationDb
  let runtime: OrcaRuntimeService
  let runId: string
  let bot: { botId: string; teamId: string }

  beforeEach(() => {
    denial.denies = false
    db = new OrchestrationDb(':memory:')
    runtime = new OrcaRuntimeService()
    runtime.setOrchestrationDb(db)
    runId = db.createRun({
      objective: 'Start a child over the CLI',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: PANE_KEY
    }).id
    vi.spyOn(runtime, 'getTerminalPaneKey').mockImplementation((handle) =>
      handle === 'term_coord' ? PANE_KEY : null
    )
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Ann', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Flyer',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, BOT_SESSION)
    bot = { botId: team.bots[0].id, teamId: team.id }
    vi.mocked(startLocalWorker).mockClear()
    vi.mocked(startFederatedWorker).mockClear()
  })

  afterEach(() => db.close())

  async function startWorker(caller: OrchestrationSessionCaller | undefined, on?: string) {
    const task = db.createTask({ spec: 'Do the part', runId })
    const method = ORCHESTRATION_METHODS.find((entry) => entry.name === 'orchestration.workerStart')
    if (!method) {
      throw new Error('workerStart method is not registered')
    }
    const params = method.params!.parse({
      task: task.id,
      from: 'term_coord',
      worktree: 'current',
      agent: 'pi',
      ...(on ? { on } : {})
    })
    return method.handler(params, {
      runtime,
      ...(caller ? { orchestrationCaller: caller } : {})
    })
  }

  it('hands the bot to the local start, so its worker carries the marker', async () => {
    await startWorker(BOT_CALLER)
    expect(vi.mocked(startLocalWorker).mock.calls.at(-1)?.[0].botRun).toEqual(bot)
  })

  it('names no bot for a session no bot runs, or a terminal coordinator', async () => {
    await startWorker(PLAIN_CALLER)
    expect(vi.mocked(startLocalWorker).mock.calls.at(-1)?.[0]).not.toHaveProperty('botRun')
    await startWorker(undefined)
    expect(vi.mocked(startLocalWorker).mock.calls.at(-1)?.[0]).not.toHaveProperty('botRun')
  })

  it('refuses a remote worker for a bot kept out of an app: that host cannot be given the marker', async () => {
    denial.denies = true
    await expect(startWorker(BOT_CALLER, 'server-1')).rejects.toMatchObject({
      code: 'capability_unsupported'
    })
    expect(startFederatedWorker).not.toHaveBeenCalled()
  })

  it('still starts a remote worker for a bot kept out of nothing and for a non-bot caller', async () => {
    await startWorker(BOT_CALLER, 'server-1')
    denial.denies = true
    await startWorker(PLAIN_CALLER, 'server-1')
    expect(startFederatedWorker).toHaveBeenCalledTimes(2)
  })
})

describe('refuseDeniedBotCaller', () => {
  const BOT_OPTIONS = { botTeamBotId: 'bob', botTeamId: 't1' }
  const runtime = {
    ensureStructuredAgentSessionHost: async () => {},
    getOrchestrationDb: () => ({ db: { prepare: () => ({ get: () => undefined }) } })
  } as never

  function installRecords(): void {
    hostRef.current = {
      deps: {
        store: {
          getRecord: (id: string) =>
            id === SESSION_X
              ? { ...sessionRecord(SESSION_X), options: BOT_OPTIONS }
              : id === SESSION_Y
                ? sessionRecord(SESSION_Y)
                : null,
          listRecords: () => []
        }
      }
    }
  }

  beforeEach(() => {
    denial.denies = false
    installRecords()
  })
  afterEach(() => {
    hostRef.current = null
  })

  const run = (evidence: unknown, extra: Record<string, unknown> = {}) =>
    refuseDeniedBotCaller(
      runtime,
      { orchestrationCompatibilityEvidence: evidence, ...extra } as never,
      'a terminal'
    )

  it('refuses a caller session whose bot is kept out of an app', async () => {
    denial.denies = true
    await expect(run({ agentSessionId: SESSION_X })).rejects.toMatchObject({
      code: 'capability_unsupported'
    })
  })

  it('lets through a bot kept out of nothing, a session no bot runs, and an unknown session', async () => {
    await expect(run({ agentSessionId: SESSION_X })).resolves.toBeUndefined()
    denial.denies = true
    await expect(run({ agentSessionId: SESSION_Y })).resolves.toBeUndefined()
    await expect(
      run({ agentSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
    ).resolves.toBeUndefined()
  })

  it('leaves a request with no caller evidence, or one from another host, exactly as it was', async () => {
    denial.denies = true
    const touched = vi.fn()
    hostRef.current = new Proxy({}, { get: touched })
    await expect(run(undefined)).resolves.toBeUndefined()
    await expect(run({ terminalHandle: 'term_1' })).resolves.toBeUndefined()
    expect(touched).not.toHaveBeenCalled()
    installRecords()
    await expect(
      run({ agentSessionId: SESSION_X }, { pairedDeviceId: 'phone' })
    ).resolves.toBeUndefined()
    await expect(
      run({
        agentSessionId: SESSION_X,
        host: { kind: 'ssh', targetId: 't', connectionIncarnation: 'c', attachmentId: 'a' }
      })
    ).resolves.toBeUndefined()
  })
})
