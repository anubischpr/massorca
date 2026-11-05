import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { BotTeamPrototypeChoice } from '../../shared/bot-team-prototype-choice'
import { botTeamPrototypeChoiceOfSession } from '../bot-teams/bot-team-session-prototype-choice'
import type { PrototypeDesignSystemMode } from '../../shared/prototype-design-system-files'
import { boundJournalPromptBody } from '../native-chat/agent-session-journal/journal-prompt-body-bounds'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import {
  delegationQuestionItemId,
  delegationQuestionRowIdentity,
  type DelegationPrototypeCount
} from '../../shared/delegated-session-journal'
import {
  PROTOTYPE_CARD_COUNT_CHOICES,
  sanitizePrototypeCountSetting
} from '../../shared/prototype-count-setting'
import { neutralizePrototypeMarkers } from '../../shared/prototype-hidden-instruction'
import {
  decideDelegatedTaskPrototypeCount,
  delegatedTaskAsksForPrototypes
} from '../../shared/prototype-request-decision'
import type { PrototypeSystemCard } from '../../shared/prototype-design-system-card'
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../shared/rpc-contract/prototype-params'
import { prototypeAgentOfChild } from './delegated-child-first-prompt'
import {
  buildDelegationCardContent,
  routeDelegationRequestWithAdvice,
  type DelegationStoredAgent
} from './delegation-options'
import type { DelegationRequestDeps } from './delegation-service-types'
import { waitForDelegationUsageRefresh } from './delegation-usage-refresh'

export type DelegationRequestInput = {
  parentSessionId: string
  summary: string
  prompt: string
  title?: string
  writes: boolean
}

export type DelegationRequestReceipt =
  | { requestId: string; status: 'awaiting_choice'; questionItemId: string }
  /** A bot-run chat's request, started on the router's choice with no card. */
  | { requestId: string; status: 'starting' }

const CARD_QUESTION = 'Which agent should handle this session?'
const TITLE_MAX_CHARS = 80

function titleFor(input: DelegationRequestInput): string {
  const given = input.title?.trim()
  const base = given && given.length > 0 ? given : input.summary.trim()
  return base.length > TITLE_MAX_CHARS ? `${base.slice(0, TITLE_MAX_CHARS - 1)}…` : base
}

/**
 * The count question a task that asks for prototypes puts on its card. A task too long for a child's
 * first prompt makes no prototype request, so it asks nothing.
 */
function prototypeCountFor(
  input: DelegationRequestInput,
  agents: readonly DelegationStoredAgent[],
  readSetting: () => unknown,
  userMessage: string | undefined
): DelegationPrototypeCount | undefined {
  if (input.prompt.length > PROTOTYPE_PROMPT_MAX_LENGTH) {
    return undefined
  }
  const decision = decideDelegatedTaskPrototypeCount({
    text: neutralizePrototypeMarkers(input.prompt),
    agents: agents.map((agent) => prototypeAgentOfChild(agent.agent, agent.piRuntime)),
    setting: sanitizePrototypeCountSetting(readSetting()),
    ...(userMessage === undefined ? {} : { userMessage })
  })
  return decision.kind === 'ask'
    ? { choices: PROTOTYPE_CARD_COUNT_CHOICES, defaultCount: decision.defaultCount }
    : undefined
}

/**
 * Whether the task makes a prototype request for its child: by its own words, or because the person asked for
 * the design in a child session. A task too long for a child's first prompt makes none.
 */
function asksForPrototypes(
  input: DelegationRequestInput,
  agents: readonly DelegationStoredAgent[],
  userMessage: string | undefined
): boolean {
  return (
    input.prompt.length <= PROTOTYPE_PROMPT_MAX_LENGTH &&
    delegatedTaskAsksForPrototypes({
      text: neutralizePrototypeMarkers(input.prompt),
      agents: agents.map((agent) => prototypeAgentOfChild(agent.agent, agent.piRuntime)),
      ...(userMessage === undefined ? {} : { userMessage })
    })
  )
}

/** The person's last message in the parent chat; a read that fails leaves the task to its own words. */
async function userMessageOf(
  read: DelegationRequestDeps['readParentUserMessage'],
  parentSessionId: string
): Promise<string | undefined> {
  try {
    return await read(parentSessionId)
  } catch (error) {
    console.warn(
      `[delegated-session] last message not read for ${parentSessionId}; the task is read by its own words: ${String(error)}`
    )
    return undefined
  }
}

/**
 * The design system question a task that asks for prototypes puts on its card, as a direct request's card
 * does: whatever the count setting says, and only when the project's system could be read.
 */
async function designSystemFor(
  input: DelegationRequestInput,
  asks: boolean,
  read: DelegationRequestDeps['readDesignSystemCard']
): Promise<PrototypeSystemCard | undefined> {
  if (!asks) {
    return undefined
  }
  try {
    return (await read(input.parentSessionId)) ?? undefined
  } catch (error) {
    console.warn(
      `[delegated-session] design system not read for ${input.parentSessionId}; the card asks none: ${String(error)}`
    )
    return undefined
  }
}

/**
 * The answers a bot run's prototype child is filed with. No person answers a bot task's cards, so the room's
 * count stands in for the count card, and a design system a person would have to review ('propose') becomes 'use'.
 */
function botRunPrototypeAnswers(choice: BotTeamPrototypeChoice | null): {
  count?: number
  designSystem?: PrototypeDesignSystemMode
} {
  if (choice === null) {
    return {}
  }
  return { count: choice.count, designSystem: choice.designSystem === 'skip' ? 'skip' : 'use' }
}

/** Files delegated-session requests and posts their agent-choice cards to the parent chat. */
export class DelegationRequestService {
  constructor(private readonly deps: DelegationRequestDeps) {}

  /** Files a request whose agent is already decided, so no card asks; the answer service starts it. */
  async requestForAgent(
    input: DelegationRequestInput & {
      agent: string
      /** The model and effort this child must run with, rather than ones sized from its summary. */
      launch?: Readonly<Record<string, string>>
      /** Which Pi this child runs; absent, the host picks whichever it has. */
      piRuntime?: PiRuntimeSelection
    }
  ): Promise<string> {
    const parent = this.deps.readParent(input.parentSessionId)
    if (!parent) {
      throw new OrchestrationError(
        'delegation_parent_unavailable',
        `Chat ${input.parentSessionId} is not held by this host, so it cannot start a child session. No effects were applied.`,
        { effectsApplied: false }
      )
    }
    const agents = await this.deps.listAgents(parent)
    if (!agents.some((entry) => entry.agent === input.agent)) {
      throw new OrchestrationError(
        'delegation_no_agent',
        `${input.agent} cannot run a chat in this workspace, so no child session can start. No effects were applied.`,
        { effectsApplied: false }
      )
    }
    const handOff = await this.botRunHandOffAnswers(input, agents, parent.sessionId)
    return this.deps.requireDb().createDelegationRequest({
      parentSessionId: parent.sessionId,
      title: titleFor(input),
      summary: input.summary,
      prompt: input.prompt,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      optionsJson: JSON.stringify({ agents, ...handOff }),
      decisionJson:
        input.launch || input.piRuntime
          ? JSON.stringify({
              ...(input.launch ? { launch: input.launch } : {}),
              ...(input.piRuntime ? { piRuntime: input.piRuntime } : {})
            })
          : null
    }).id
  }

  /** A bot run's hand-off whose work is a prototype is filed with the run's room choice, as its own requests are. */
  private async botRunHandOffAnswers(
    input: DelegationRequestInput,
    agents: readonly DelegationStoredAgent[],
    parentSessionId: string
  ): Promise<{ prototype?: true; count?: number; designSystem?: PrototypeDesignSystemMode }> {
    if (this.deps.isBotRunSession?.(parentSessionId) !== true) {
      return {}
    }
    const userMessage = await userMessageOf(this.deps.readParentUserMessage, parentSessionId)
    if (!asksForPrototypes(input, agents, userMessage)) {
      return {}
    }
    const choice = botTeamPrototypeChoiceOfSession(this.deps.requireDb(), parentSessionId)
    return { prototype: true, ...botRunPrototypeAnswers(choice) }
  }

  /** Files a request and posts its card to the parent chat; returns without waiting for a choice. */
  async request(input: DelegationRequestInput): Promise<DelegationRequestReceipt> {
    const parent = this.deps.readParent(input.parentSessionId)
    if (!parent) {
      throw new OrchestrationError(
        'delegation_parent_unavailable',
        `Chat ${input.parentSessionId} is not held by this host, so it cannot start a child session. No effects were applied.`,
        { effectsApplied: false }
      )
    }
    const agents = await this.deps.listAgents(parent)
    if (agents.length === 0) {
      throw new OrchestrationError(
        'delegation_no_agent',
        'No agent that can run a chat is usable in this workspace, so no child session can start. No effects were applied.',
        { effectsApplied: false }
      )
    }
    const title = titleFor(input)
    await waitForDelegationUsageRefresh(this.deps.refreshUsage)
    const route = await routeDelegationRequestWithAdvice(
      {
        summary: input.summary,
        title,
        prompt: input.prompt,
        writes: input.writes,
        workspaceKind: parent.workspaceKind,
        parentAgent: parent.agent,
        agents,
        rateLimits: this.deps.readRateLimits(),
        now: this.deps.now()
      },
      this.deps.adviseTier
    )
    const userMessage = await userMessageOf(this.deps.readParentUserMessage, input.parentSessionId)
    const prototypeTask = asksForPrototypes(input, agents, userMessage)
    const botRun = this.deps.isBotRunSession?.(parent.sessionId) === true
    const prototypeCount = prototypeCountFor(
      input,
      agents,
      this.deps.readPrototypeCount,
      userMessage
    )
    const designSystem = await designSystemFor(input, prototypeTask, this.deps.readDesignSystemCard)
    const db = this.deps.requireDb()
    const row = db.createDelegationRequest({
      parentSessionId: parent.sessionId,
      title,
      summary: input.summary,
      prompt: input.prompt,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      // Why stored: the child's first prompt makes its request from this decision, not from the wording again.
      optionsJson: JSON.stringify({
        agents,
        ...(prototypeTask ? { prototype: true } : {}),
        ...(botRun && prototypeTask
          ? botRunPrototypeAnswers(botTeamPrototypeChoiceOfSession(db, parent.sessionId))
          : {})
      }),
      decisionJson: route.status === 'routed' ? JSON.stringify(route.decision) : null
    })
    // Why: no person answers a bot task's cards, so its child waited on one for good.
    const startAutomatic = this.deps.startAutomatic
    if (route.status === 'routed' && startAutomatic && botRun) {
      try {
        startAutomatic(row.id)
      } catch (error) {
        db.transitionDelegationRequest(row.id, 'pending', 'failed', {
          failure: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
      return { requestId: row.id, status: 'starting' }
    }
    const card = buildDelegationCardContent({
      requestId: row.id,
      title,
      summary: input.summary,
      prompt: input.prompt,
      route,
      agents,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      ...(prototypeCount ? { prototypeCount } : {}),
      ...(designSystem ? { designSystem } : {})
    })
    // Recorded before the card can be seen, so a card in the chat always has its question on record.
    const questionItemId = delegationQuestionItemId(row.id)
    db.patchDelegationRequest(row.id, { question_item_id: questionItemId })
    try {
      await this.deps.rows.appendHostRow(
        parent.sessionId,
        delegationQuestionRowIdentity(row.id),
        boundJournalPromptBody({
          kind: 'question',
          question: CARD_QUESTION,
          options: card.options,
          delegation: card.payload,
          resolution: {
            state: 'pending',
            selectedOptionId: null,
            resolvedBy: null,
            resolvedAt: null
          }
        })
      )
    } catch (error) {
      db.transitionDelegationRequest(row.id, 'pending', 'failed', {
        failure: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
    return { requestId: row.id, status: 'awaiting_choice', questionItemId }
  }
}
