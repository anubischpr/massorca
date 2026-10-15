import type { StructuredAgentId } from '../../shared/agent-session-provider-handle'
import { agentSessionRefusalError } from '../../shared/agent-session-wire-refusals'
import {
  structuredAgentRuntimeRegistration,
  type StructuredAgentAccountHomeRequest,
  type StructuredAgentAccountHomeServices
} from './structured-agent-runtime-registrations'

/** Shares registration dispatch between record-less catalog reads and new session intent. */
export function registeredStructuredAccountHomeResolver(args: {
  agent: StructuredAgentId
  purpose: StructuredAgentAccountHomeRequest['purpose']
  workspacePath: StructuredAgentAccountHomeRequest['workspacePath']
  services: StructuredAgentAccountHomeServices
}) {
  const registration = structuredAgentRuntimeRegistration(args.agent)
  if (!registration) {
    return null
  }
  return async (
    context: Pick<StructuredAgentAccountHomeRequest, 'launchEnv' | 'commandSettings' | 'location'>
  ) =>
    registration.resolveAccountHome(
      {
        ...context,
        location: context.location ?? null,
        purpose: args.purpose,
        workspacePath: args.workspacePath
      },
      args.services
    )
}

export function requireStructuredAgentDefinition(agent: StructuredAgentId) {
  const definition = structuredAgentRuntimeRegistration(agent)?.definition
  if (!definition) {
    throw agentSessionRefusalError('structured_agent_session_unsupported', {
      reason: 'hostUnsupported'
    })
  }
  return definition
}
