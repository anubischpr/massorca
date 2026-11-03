import { AskUserQuestionsInput } from '../../../../../../shared/agent-ask-user-journal'
import { clampOrchestrationAskTimeoutMs } from '../../../../../../shared/orchestration-ask-timeout'
import { AskUserParams } from '../../../../../../shared/rpc-contract/orchestration-ask-user-params'
import { getAskUserService } from '../../../../../delegated-session/delegation-runtime'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { defineMethod } from '../../../core'

function parseQuestions(text: string): ReturnType<typeof AskUserQuestionsInput.parse> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    raw = undefined
  }
  const parsed = AskUserQuestionsInput.safeParse(raw)
  if (!parsed.success) {
    throw new OrchestrationError(
      'invalid_argument',
      'questions must be JSON: {"questions":[{"question":"...","options":["A","B"],"multiSelect":false}]} with 1-4 questions of 1-12 options each. Nothing was asked.',
      { effectsApplied: false }
    )
  }
  return parsed.data
}

export const ORCHESTRATION_ASK_USER_METHODS = [
  defineMethod({
    name: 'orchestration.askUser',
    permission: 'workspace',
    params: AskUserParams,
    handler: async (params, { runtime, orchestrationCaller, signal }) => {
      // The card goes into the caller's own chat; a terminal has none to show it in.
      if (!orchestrationCaller) {
        throw new OrchestrationError(
          'ask_user_requires_chat',
          'orchestration ask-user can only be used from a MassOrca chat session, which identifies itself with ORCA_AGENT_SESSION_ID. Nothing was asked.',
          { effectsApplied: false }
        )
      }
      const questions = parseQuestions(params.questions)
      await runtime.ensureStructuredAgentSessionHost()
      return getAskUserService().ask({
        sessionId: orchestrationCaller.sessionId,
        questions,
        timeoutMs: clampOrchestrationAskTimeoutMs(params.timeoutMs),
        ...(signal ? { signal } : {})
      })
    }
  })
]
