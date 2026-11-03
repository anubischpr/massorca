import type { CommandHandler } from '../../dispatch'
import { printResult } from '../../format'
import { getOptionalNonNegativeIntegerFlag, getOptionalStringFlag } from '../../flags'
import { RuntimeClientError } from '../../runtime-client'
import { askUserQuestionFromFlags } from '../../../shared/agent-ask-user-journal'
import { readInjectedAgentSessionId } from '../../../shared/agent-session-caller-env'
import { resolveOrchestrationAskClientTimeoutMs } from '../../../shared/orchestration-ask-timeout'
import { ORCHESTRATION_ASK_USER_RUNTIME_CAPABILITY } from '../../../shared/protocol-version'
import type { AskUserResult } from '../../../shared/rpc-contract/orchestration-ask-user-params'
import type { RuntimeStatus } from '../../../shared/runtime-types'

/** The questions as the JSON text the host parses, from `--questions` or the plain one-question flags. */
function readQuestionsFlag(flags: Map<string, string | boolean>): string {
  const json = getOptionalStringFlag(flags, 'questions')
  const question = getOptionalStringFlag(flags, 'question')
  const options = getOptionalStringFlag(flags, 'options')
  if (json !== undefined && (question !== undefined || options !== undefined)) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pass either --questions <json> or --question <text> --options <a,b,c>, not both. Nothing was asked.'
    )
  }
  if (json !== undefined) {
    return json
  }
  if (!question?.trim() || !options?.trim()) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Missing --question <text> --options <a,b,c> (or --questions <json>). Nothing was asked.'
    )
  }
  return JSON.stringify(
    askUserQuestionFromFlags({
      question,
      options,
      multiSelect: flags.get('multi-select') === true
    })
  )
}

export const ORCHESTRATION_ASK_USER_HANDLER: Record<string, CommandHandler> = {
  'orchestration ask-user': async ({ flags, client, json }) => {
    if (!readInjectedAgentSessionId()) {
      throw new RuntimeClientError(
        'ask_user_requires_chat',
        'orchestration ask-user can only be used from a MassOrca chat session (ORCA_AGENT_SESSION_ID is not set in this environment). Nothing was asked.'
      )
    }
    const questions = readQuestionsFlag(flags)
    const status = await client.call<RuntimeStatus>('status.get')
    if (!status.result.capabilities?.includes(ORCHESTRATION_ASK_USER_RUNTIME_CAPABILITY)) {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'The connected MassOrca runtime cannot show question cards from the command line. Ask the question in plain text instead.'
      )
    }
    const timeoutMs = getOptionalNonNegativeIntegerFlag(flags, 'timeout-ms')
    // Not retried: a repeat would post a second card while the first still waits.
    const result = await client.call<AskUserResult>(
      'orchestration.askUser',
      { questions, ...(timeoutMs !== undefined ? { timeoutMs } : {}) },
      { timeoutMs: resolveOrchestrationAskClientTimeoutMs(timeoutMs) }
    )
    printResult(result, json, (value) =>
      value.status === 'answered'
        ? value.answer
        : value.status === 'cancelled'
          ? 'The person dismissed the question without answering.'
          : 'Nobody answered the question in time; it was withdrawn.'
    )
    if (result.result.status !== 'answered') {
      process.exitCode = 1
    }
  }
}
