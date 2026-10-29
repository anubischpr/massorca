import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { orderTabLaunchAgents } from '../tab-bar/tab-agent-launch-options'

/** Agents create-chat never offers: Gemini CLI is retired in favour of Antigravity. */
const CREATE_CHAT_RETIRED_AGENTS: ReadonlySet<TuiAgent> = new Set<TuiAgent>(['gemini'])

export type CreateChatAgentAvailabilityInput = {
  /** Agents detected on the selected host; null while detection is in flight. */
  detected: readonly TuiAgent[] | null
  /** Whether the host runs Pi or Gentle Shell, which PATH detection alone cannot see. */
  piAvailable: boolean
  /** The structured agents the host listed; undefined until it has. */
  hostStructuredAgents: readonly string[] | undefined
  defaultAgent: TuiAgent | 'blank' | null | undefined
  disabled: Iterable<unknown> | null | undefined
}

/**
 * The agents create-chat offers on a host: installed there and able to open as a chat. Claude and
 * Codex are chats on every structured host; any other agent only once the host has listed it.
 */
export function createChatAgentsForHost(input: CreateChatAgentAvailabilityInput): TuiAgent[] {
  const installed: TuiAgent[] = [...(input.detected ?? [])]
  if (input.piAvailable && !installed.includes('pi')) {
    installed.push('pi')
  }
  const chatAgents = installed.filter(
    (agent) =>
      !CREATE_CHAT_RETIRED_AGENTS.has(agent) &&
      (isAgentSessionHandleProvider(agent) || input.hostStructuredAgents?.includes(agent) === true)
  )
  return orderTabLaunchAgents(input.defaultAgent, chatAgents, input.disabled)
}
