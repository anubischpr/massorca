import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { RuntimeRpcCallError } from '@/runtime/runtime-rpc-result'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import {
  AGENT_SESSION_PLAN_DOCUMENT_READ_ERRORS,
  type AgentSessionPlanDocumentReadError,
  type AgentSessionReadPlanDocumentResult
} from '../../../../shared/rpc-contract/agent-session-plan-document-params'

/** `unsupported`: the host predates the read. `unavailable`: contact lost; never a verdict on the file. */
export type NativeChatPlanDocumentOutcome =
  | { kind: 'ready'; text: string }
  | { kind: 'refused'; error: AgentSessionPlanDocumentReadError }
  | { kind: 'unsupported' }
  | { kind: 'unavailable' }

const READ_TIMEOUT_MS = 15_000

function isKnownRefusal(value: unknown): value is AgentSessionPlanDocumentReadError {
  return AGENT_SESSION_PLAN_DOCUMENT_READ_ERRORS.some((known) => known === value)
}

/** The plan document from the host that owns the chat; it never touches the generic file open. */
export async function readNativeChatPlanDocument(input: {
  target: RuntimeClientTarget
  sessionId: string
  path: string
}): Promise<NativeChatPlanDocumentOutcome> {
  try {
    const result = await callRuntimeRpc<AgentSessionReadPlanDocumentResult>(
      input.target,
      'agentSession.readPlanDocument',
      { sessionId: input.sessionId, path: input.path },
      { timeoutMs: READ_TIMEOUT_MS }
    )
    if (!result || typeof result !== 'object') {
      return { kind: 'unavailable' }
    }
    if (!result.ok) {
      return isKnownRefusal(result.error)
        ? { kind: 'refused', error: result.error }
        : { kind: 'unavailable' }
    }
    return 'text' in result && typeof result.text === 'string'
      ? { kind: 'ready', text: result.text }
      : { kind: 'unavailable' }
  } catch (error) {
    // A host without the method, or one that does not let this client call it.
    return error instanceof RuntimeRpcCallError &&
      (error.code === 'method_not_found' || error.code === 'forbidden')
      ? { kind: 'unsupported' }
      : { kind: 'unavailable' }
  }
}
