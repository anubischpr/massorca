import {
  DELEGATION_SUMMARY_MAX_CHARS,
  DelegateRequestParams
} from '../../../../../../shared/rpc-contract/orchestration-delegate-request-params'
import { getDelegationRequestService } from '../../../../../delegated-session/delegation-runtime'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { defineMethod } from '../../../core'

export const ORCHESTRATION_DELEGATION_METHODS = [
  defineMethod({
    name: 'orchestration.delegateRequest',
    permission: 'workspace',
    params: DelegateRequestParams,
    handler: async (params, { runtime, orchestrationCaller }) => {
      // Only a chat can be asked which agent it wants; a terminal has no card to post it on.
      if (!orchestrationCaller) {
        throw new OrchestrationError(
          'delegation_requires_chat',
          'orchestration delegate can only be used from an Orca chat session, which identifies itself with ORCA_AGENT_SESSION_ID. No effects were applied.',
          { effectsApplied: false }
        )
      }
      if (params.summary.length > DELEGATION_SUMMARY_MAX_CHARS || params.summary.includes('\n')) {
        throw new OrchestrationError(
          'invalid_argument',
          `summary is a one-line abstract of at most ${DELEGATION_SUMMARY_MAX_CHARS} characters; put the full task in prompt. No effects were applied.`,
          { effectsApplied: false }
        )
      }
      await runtime.ensureStructuredAgentSessionHost()
      return getDelegationRequestService(runtime).request({
        parentSessionId: orchestrationCaller.sessionId,
        summary: params.summary,
        prompt: params.prompt,
        ...(params.title ? { title: params.title } : {}),
        writes: params.writes === true
      })
    }
  })
]
