// `agentSessionChecklist.*` — the person's checks, notes and screenshots on a chat's checklist.
//
// Additive: clients call them where the host advertises `agent-session.checklist.v1`; an older host
// answers `method_not_found` (a phone gets `forbidden` from the mobile allowlist gate), and the
// client shows the checklist read-only. Every location keeps its marks here, on the owning host.

import {
  ChecklistReadParams,
  ChecklistSetItemParams,
  type AgentSessionChecklistResult
} from '../../../../shared/rpc-contract/agent-session-checklist-params'
import { getNativeChatChecklistStore } from '../../../native-chat/native-chat-checklist-store-registry'
import { defineMethod } from '../core'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_CHECKLIST_METHODS = [
  defineMethod({
    name: 'agentSessionChecklist.read',
    permission: 'workspace',
    params: ChecklistReadParams,
    handler: async (params, ctx): Promise<AgentSessionChecklistResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      if (!host.deps.store.getRecord(params.sessionId)) {
        return { ok: false, error: 'session_not_found' }
      }
      return { ok: true, state: await getNativeChatChecklistStore().read(params.sessionId) }
    }
  }),
  defineMethod({
    name: 'agentSessionChecklist.setItem',
    permission: 'workspace',
    params: ChecklistSetItemParams,
    handler: async (params, ctx): Promise<AgentSessionChecklistResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      if (!host.deps.store.getRecord(params.sessionId)) {
        return { ok: false, error: 'session_not_found' }
      }
      return { ok: true, state: await getNativeChatChecklistStore().setItem(params) }
    }
  })
]
