// `agentSession.readPlanDocument` — one Antigravity plan-mode document, from the owning host.
//
// Additive: an older host answers `method_not_found`, which the client shows as "not supported by
// this host". The generic remote file open stays restricted to the worktree.

import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import {
  ANTIGRAVITY_STRUCTURED_HANDLE_NAMESPACE,
  isAgentSessionProviderHandleInNamespace
} from '../../../../shared/agent-session-provider-handle-encoding'
import {
  ReadPlanDocumentParams,
  type AgentSessionReadPlanDocumentResult
} from '../../../../shared/rpc-contract/agent-session-plan-document-params'
import { readAntigravityPlanDocument } from '../../../native-chat/antigravity-plan-document-read'
import { defineMethod } from '../core'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_PLAN_DOCUMENT_METHODS = [
  defineMethod({
    name: 'agentSession.readPlanDocument',
    permission: 'workspace',
    params: ReadPlanDocumentParams,
    handler: async (params, ctx): Promise<AgentSessionReadPlanDocumentResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const record = host.deps.store.getRecord(params.sessionId)
      if (!record) {
        return { ok: false, error: 'session_not_found' }
      }
      if (
        record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
        record.location.wslDistro
      ) {
        return { ok: false, error: 'unsupported_location' }
      }
      const conversationIds = new Set(
        record.providerHandleChain
          .map((link) => link.handle)
          .filter((handle) =>
            isAgentSessionProviderHandleInNamespace(handle, ANTIGRAVITY_STRUCTURED_HANDLE_NAMESPACE)
          )
          .map((handle) => handle.nativeId)
      )
      return readAntigravityPlanDocument({
        path: params.path,
        conversationIds,
        ...(params.knownRevision ? { knownRevision: params.knownRevision } : {})
      })
    }
  })
]
