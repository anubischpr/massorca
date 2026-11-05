// What the composer does with a message that may ask for prototypes.
import {
  classifyPrototypeRequest,
  type PrototypeAgent,
  type PrototypeRequest
} from './prototype-request'
import type { PrototypeCountSetting } from './prototype-count-setting'
import type { PrototypeDesignSystemMode } from './prototype-design-system-files'
import { asksForDelegatedSession } from './prototype-delegated-ask'

/**
 * The answer of the "How many prototypes?" card: a count, or the message as typed. Once the design system card
 * answers too, the same choice carries its mode; the count is then the one the card was shown for.
 */
export type NativeChatPrototypeChoice =
  | { count: number; designSystem?: PrototypeDesignSystemMode }
  | 'as-typed'

export type NativeChatPrototypeDecision =
  | { kind: 'as-typed' }
  | { kind: 'create'; count: number }
  | {
      kind: 'ask'
      /** A keyword match, not a command: the card then also offers "Not a prototype". */
      keyword: boolean
    }

export function decideNativeChatPrototypeRequest(input: {
  text: string
  agent: PrototypeAgent
  setting: PrototypeCountSetting
  choice?: NativeChatPrototypeChoice
  /**
   * Whether hand-off wording leaves the request to the child; default true. A room worker passes false: it is
   * not the lead, and nothing else would ask.
   */
  handOffExempt?: boolean
}): NativeChatPrototypeDecision {
  const request: PrototypeRequest = classifyPrototypeRequest(input.text, input.agent)
  // Why: a keyword match that hands the design to a child session is that child's request, made by its own first prompt.
  const handedToChild =
    input.handOffExempt !== false &&
    request.kind === 'keyword' &&
    asksForDelegatedSession(input.text)
  if (request.kind === 'none' || handedToChild || input.choice === 'as-typed') {
    return { kind: 'as-typed' }
  }
  if (input.choice) {
    return { kind: 'create', count: input.choice.count }
  }
  // An explicit command applies the setting; a keyword match always asks.
  if (settingAnswers(request, input.setting)) {
    return { kind: 'create', count: input.setting.count }
  }
  return { kind: 'ask', keyword: request.kind === 'keyword' }
}

/** An explicit command under Settings "always" takes the Settings count without asking. */
function settingAnswers(request: PrototypeRequest, setting: PrototypeCountSetting): boolean {
  return request.kind === 'command' && setting.mode === 'always'
}

/** A delegated task's count question: none, or the question with the Settings count as its default. */
export type DelegatedTaskPrototypeCount = { kind: 'none' } | { kind: 'ask'; defaultCount: number }

/**
 * The count question a delegated task's card asks, before its agent is picked. The child is the
 * hand-off, so the task text is classified as typed, with no hand-off exemption. `agents` are the
 * agents the card offers, since any of them may run the task.
 */
export function decideDelegatedTaskPrototypeCount(input: {
  text: string
  agents: readonly PrototypeAgent[]
  setting: PrototypeCountSetting
  /** What the person last typed in the parent chat; it can make a task a prototype task its own words do not. */
  userMessage?: string
}): DelegatedTaskPrototypeCount {
  const request = delegatedTaskPrototypeRequest(input.text, input.agents, input.userMessage)
  if (request.kind === 'none' || settingAnswers(request, input.setting)) {
    return { kind: 'none' }
  }
  return { kind: 'ask', defaultCount: input.setting.count }
}

/**
 * Whether a delegated task makes a prototype request for its child, whatever the count setting says. The
 * design system question follows this, as the direct request's card follows every created request.
 */
export function delegatedTaskAsksForPrototypes(input: {
  text: string
  agents: readonly PrototypeAgent[]
  userMessage?: string
}): boolean {
  return delegatedTaskPrototypeRequest(input.text, input.agents, input.userMessage).kind !== 'none'
}

/**
 * Whether the person asked, in their own words, for a design to be made in a child session. The composer sent
 * that message as typed and left the request to the child, so the task the parent agent wrote for it is a
 * prototype task even when the agent's wording (it may say "architecture") reads as none.
 */
export function personHandedPrototypeToChild(
  userMessage: string,
  agents: readonly PrototypeAgent[]
): boolean {
  return (
    asksForDelegatedSession(userMessage) &&
    agents.some((agent) => classifyPrototypeRequest(userMessage, agent).kind === 'keyword')
  )
}

function delegatedTaskPrototypeRequest(
  text: string,
  agents: readonly PrototypeAgent[],
  userMessage?: string
): PrototypeRequest {
  const requests = agents.map((agent) => classifyPrototypeRequest(text, agent))
  const own =
    requests.find((entry) => entry.kind === 'command') ??
    requests.find((entry) => entry.kind === 'keyword')
  if (own !== undefined) {
    return own
  }
  return userMessage !== undefined && personHandedPrototypeToChild(userMessage, agents)
    ? { kind: 'keyword' }
    : { kind: 'none' }
}
