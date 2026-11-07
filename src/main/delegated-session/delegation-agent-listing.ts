import type { StructuredAgentId } from '../../shared/agent-session-provider-handle'
import { GENTLE_SHELL_LABEL } from '../../shared/agent-type-label'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import { isTuiAgent } from '../../shared/tui-agent-config'
import { TUI_AGENT_DISPLAY_NAMES } from '../../shared/tui-agent-display-names'
import type { StructuredAgentSessionCreateSupport } from '../native-chat/structured-agent-session-create-support'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { STRUCTURED_AGENT_RUNTIME_REGISTRATIONS } from '../runtime/structured-agent-runtime-registrations'
import type { DelegationAgentRefusal, DelegationStoredAgent } from './delegation-options'
import type { DelegationRequestDeps } from './delegation-service-types'

/** The one create check the agent listing reads, on the host that runs the delegation. */
export type AgentCheckRuntime = Pick<OrcaRuntimeService, 'getStructuredAgentSessionCreateSupport'>

export type CheckedAgents = {
  /** The agents this host registers that can start a chat in the workspace right now. */
  usable: DelegationStoredAgent[]
  /** The agents this host registers that cannot, each with the reason its check gave. */
  refused: DelegationAgentRefusal[]
}

/** One agent's check: usable, or refused with the reason its check gave. */
type AgentCheck = { usable: DelegationStoredAgent } | { refused: DelegationAgentRefusal }

function agentLabel(agent: string, piRuntime: string | undefined): string {
  if (agent === 'pi' && piRuntime === 'gentle-shell') {
    return GENTLE_SHELL_LABEL
  }
  return isTuiAgent(agent) ? TUI_AGENT_DISPLAY_NAMES[agent] : agent
}

/** The reason a refused check names, as its verdict words it: `access`, or `agent: cliMissing`. */
function refusalReasonOf(support: StructuredAgentSessionCreateSupport): string {
  const reason = support.reason ?? 'unknown'
  return support.cause ? `${reason}: ${support.cause}` : reason
}

/**
 * Every agent this host registers, checked for a workspace right now. A Pi runtime the request names is
 * the one checked for Pi, as a bot on that runtime runs; without one, stock Pi is checked as before.
 */
export async function checkRegisteredAgents(
  runtime: AgentCheckRuntime,
  workspaceId: string,
  piRuntime?: PiRuntimeSelection
): Promise<CheckedAgents> {
  const selector = `id:${workspaceId}`
  const checks = await Promise.all(
    STRUCTURED_AGENT_RUNTIME_REGISTRATIONS.map(async ({ definition }): Promise<AgentCheck> => {
      const agent: StructuredAgentId = definition.agent
      const named = agent === 'pi' ? piRuntime : undefined
      try {
        const support = await runtime.getStructuredAgentSessionCreateSupport(selector, agent, named)
        if (!support.supported) {
          return {
            refused: { agent, label: agentLabel(agent, named), reason: refusalReasonOf(support) }
          }
        }
        // Why: a named runtime is the one the entry runs; otherwise it is the fallback the check resolved to.
        const resolved = named ?? support.piRuntime
        return {
          usable: {
            agent,
            label: agentLabel(agent, resolved),
            ...(resolved ? { piRuntime: resolved } : {})
          }
        }
      } catch (error) {
        // A check that throws leaves the agent out, and the reason is logged rather than lost.
        console.warn(`[delegated-session] checking ${agent} for a child session failed`, error)
        return { refused: { agent, label: agentLabel(agent, named), reason: 'check failed' } }
      }
    })
  )
  return {
    usable: checks.flatMap((check) => ('usable' in check ? [check.usable] : [])),
    refused: checks.flatMap((check) => ('refused' in check ? [check.refused] : []))
  }
}

/** The agent checks a delegation request reads on this runtime: the usable agents, and why the others cannot. */
export function delegationAgentDeps(
  runtime: AgentCheckRuntime
): Pick<DelegationRequestDeps, 'listAgents' | 'explainRefusals'> {
  return {
    listAgents: async (parent, piRuntime) =>
      (await checkRegisteredAgents(runtime, parent.workspaceId, piRuntime)).usable,
    explainRefusals: async (parent, piRuntime) =>
      (await checkRegisteredAgents(runtime, parent.workspaceId, piRuntime)).refused
  }
}
