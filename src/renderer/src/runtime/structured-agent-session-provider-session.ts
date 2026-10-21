import type { AgentProviderSessionMetadata } from '../../../shared/agent-session-resume'
import type { AgentSessionHistoryResult } from '../../../shared/agent-session-wire'
import { STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY } from '../../../shared/protocol-version'
import {
  runtimeEnvironmentSupportsCapability,
  type RuntimeClientTarget
} from './runtime-rpc-client'
import { callStructuredAgentSession } from './structured-agent-session-client'

/** The provider session the host's record holds for a chat, or undefined while the chat has none.
 *  Throws when the host cannot answer, so the caller never mistakes that for a brand-new chat. */
export async function readStructuredAgentSessionProviderSession(
  target: RuntimeClientTarget,
  sessionId: string
): Promise<AgentProviderSessionMetadata | undefined> {
  if (
    target.kind === 'environment' &&
    !(await runtimeEnvironmentSupportsCapability(
      target.environmentId,
      STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
    ))
  ) {
    throw new Error('This runtime does not support structured agent sessions')
  }
  // Why: a one-item tail page is enough; the history result carries the record's session either way.
  const result = await callStructuredAgentSession<AgentSessionHistoryResult>(
    target,
    'agentSession.history',
    { sessionId, direction: 'tail', limit: 1 }
  )
  return result.providerSession
}
