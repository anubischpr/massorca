import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  withBotTeamPrototypeChoice,
  type BotTeamPrototypeChoice
} from '../../shared/bot-team-prototype-choice'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import { botTeamPrototypeChoiceOfSession } from '../bot-teams/bot-team-session-prototype-choice'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { DelegationRequestService } from './delegation-request-service'
import type { DelegationParentSession, DelegationRequestDeps } from './delegation-service-types'

const NOW = 1_800_000_000_000
const PARENT: DelegationParentSession = {
  sessionId: 'session_parent_01',
  agent: 'claude',
  workspaceId: 'repo1::/work/app',
  workspaceKind: 'git',
  accessMode: 'accept-edits'
}
const AGENTS = [
  { agent: 'claude', label: 'Claude' },
  { agent: 'codex', label: 'Codex' }
]
const PROTOTYPE_PROMPT = 'Make a prototype of the onboarding screen so we can compare the layouts.'
const PLAIN_PROMPT = 'Read src/parser and list every unsafe cast with file and line.'

describe("a bot run's delegated prototype requests", () => {
  let db: OrchestrationDb
  let deps: DelegationRequestDeps

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    deps = {
      getDb: () => db,
      requireDb: () => db,
      rows: {
        appendHostRow: vi.fn(async (_sessionId, identity) => ({
          cursor: { epoch: 'e', sequence: 1 },
          itemId: JSON.stringify(identity),
          revision: 1
        }))
      },
      readParent: (sessionId) => (sessionId === PARENT.sessionId ? PARENT : null),
      listAgents: async () => AGENTS,
      readRateLimits: () => createEmptyRateLimitState({}),
      refreshUsage: async () => {},
      readPrototypeCount: () => ({ mode: 'always', count: 2 }),
      readDesignSystemCard: async () => null,
      readParentUserMessage: async () => undefined,
      now: () => NOW
    }
  })

  afterEach(() => {
    db.close()
  })

  /** A bot task the parent session runs, whose start notes keep the room's card choice when one is given. */
  function roomTask(choice: BotTeamPrototypeChoice | null = null): string {
    const team = db.createBotTeam({
      name: 'Web',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Ana', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Landing',
      prompt: 'Haz 3 prototipos de la landing',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, PARENT.sessionId)
    if (choice) {
      db.setBotTeamTaskStartNotes(task.id, withBotTeamPrototypeChoice(null, choice))
    }
    return task.id
  }

  /** The service for a bot run: its parent chat is a bot task's session, so no person answers its cards. */
  function botRunService(overrides: Partial<DelegationRequestDeps> = {}) {
    return new DelegationRequestService({
      ...deps,
      isBotRunSession: (sessionId) => sessionId === PARENT.sessionId,
      startAutomatic: vi.fn(),
      ...overrides
    })
  }

  const optionsOf = (requestId: string) =>
    JSON.parse(db.getDelegationRequest(requestId)?.options_json ?? 'null')

  const request = (prompt: string) => ({
    parentSessionId: PARENT.sessionId,
    summary: 'Onboarding prototype',
    prompt,
    writes: false
  })

  it("keeps the room's count and an unattended design system on a child that makes a prototype", async () => {
    roomTask({ count: 3 })
    const receipt = await botRunService().request(request(PROTOTYPE_PROMPT))

    expect(optionsOf(receipt.requestId)).toEqual({
      agents: AGENTS,
      prototype: true,
      count: 3,
      designSystem: 'use'
    })
  })

  it('keeps a room design system of skip, and turns propose into use, since no person answers it in a bot run', async () => {
    const taskId = roomTask({ count: 2, designSystem: 'skip' })
    const skip = await botRunService().request(request(PROTOTYPE_PROMPT))
    db.setBotTeamTaskStartNotes(
      taskId,
      withBotTeamPrototypeChoice(null, { count: 2, designSystem: 'propose' })
    )
    const propose = await botRunService().request(request(PROTOTYPE_PROMPT))

    expect(optionsOf(skip.requestId)).toMatchObject({ count: 2, designSystem: 'skip' })
    expect(optionsOf(propose.requestId)).toMatchObject({ count: 2, designSystem: 'use' })
  })

  it('stores no count when the room made no choice, as before', async () => {
    roomTask()
    const receipt = await botRunService().request(request(PROTOTYPE_PROMPT))

    expect(optionsOf(receipt.requestId)).toEqual({ agents: AGENTS, prototype: true })
  })

  it('keeps a non-bot request byte-identical, even with a room choice recorded for its session', async () => {
    roomTask({ count: 3 })
    const receipt = await new DelegationRequestService(deps).request(request(PROTOTYPE_PROMPT))

    expect(db.getDelegationRequest(receipt.requestId)?.options_json).toBe(
      JSON.stringify({ agents: AGENTS, prototype: true })
    )
  })

  it("keeps the room's count for a teammate hand-off whose work is a prototype", async () => {
    roomTask({ count: 3 })
    const requestId = await botRunService().requestForAgent({
      parentSessionId: PARENT.sessionId,
      summary: 'Onboarding prototype',
      prompt: PROTOTYPE_PROMPT,
      title: 'Onboarding prototype',
      writes: false,
      agent: 'claude'
    })

    expect(optionsOf(requestId)).toEqual({
      agents: AGENTS,
      prototype: true,
      count: 3,
      designSystem: 'use'
    })
  })

  it('files a teammate hand-off of plain work with the agents alone', async () => {
    roomTask({ count: 3 })
    const requestId = await botRunService().requestForAgent({
      parentSessionId: PARENT.sessionId,
      summary: 'Read only audit',
      prompt: PLAIN_PROMPT,
      title: 'Read only audit',
      writes: false,
      agent: 'claude'
    })

    expect(optionsOf(requestId)).toEqual({ agents: AGENTS })
  })

  it('files a hand-off from a session that is not a bot run with the agents alone', async () => {
    roomTask({ count: 3 })
    const requestId = await new DelegationRequestService(deps).requestForAgent({
      parentSessionId: PARENT.sessionId,
      summary: 'Onboarding prototype',
      prompt: PROTOTYPE_PROMPT,
      title: 'Onboarding prototype',
      writes: false,
      agent: 'claude'
    })

    expect(optionsOf(requestId)).toEqual({ agents: AGENTS })
  })

  it("reads the room's choice from the bot task whose session is the parent", () => {
    roomTask({ count: 3 })

    expect(botTeamPrototypeChoiceOfSession(db, PARENT.sessionId)).toEqual({ count: 3 })
    expect(botTeamPrototypeChoiceOfSession(db, 'session_other')).toBeNull()
  })
})
