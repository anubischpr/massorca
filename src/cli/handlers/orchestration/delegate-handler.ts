import type { CommandHandler } from '../../dispatch'
import { printResult } from '../../format'
import { getOptionalStringFlag, getRequiredStringFlag } from '../../flags'
import { RuntimeClientError } from '../../runtime-client'
import { readInjectedAgentSessionId } from '../../../shared/agent-session-caller-env'
import { ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY } from '../../../shared/protocol-version'
import {
  DELEGATION_SUMMARY_MAX_CHARS,
  type DelegateRequestResult
} from '../../../shared/rpc-contract/orchestration-delegate-request-params'
import type { RuntimeStatus } from '../../../shared/runtime-types'
import { callOrchestrationMutation } from './mutation-request'

export const ORCHESTRATION_DELEGATE_HANDLER: Record<string, CommandHandler> = {
  'orchestration delegate': async ({ flags, client, json }) => {
    // Checked before any call: the chat is the caller, and nothing else can be asked which agent it wants.
    if (!readInjectedAgentSessionId()) {
      throw new RuntimeClientError(
        'delegation_requires_chat',
        'orchestration delegate can only be used from a MassOrca chat session (ORCA_AGENT_SESSION_ID is not set in this environment). Nothing was requested.'
      )
    }
    const summary = getRequiredStringFlag(flags, 'summary').trim()
    if (summary.length > DELEGATION_SUMMARY_MAX_CHARS || /[\r\n]/.test(summary)) {
      throw new RuntimeClientError(
        'invalid_argument',
        `--summary is a one-line abstract of at most ${DELEGATION_SUMMARY_MAX_CHARS} characters; put the full task in --prompt.`
      )
    }
    const status = await client.call<RuntimeStatus>('status.get')
    if (!status.result.capabilities?.includes(ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY)) {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'The connected MassOrca runtime does not support delegated child sessions. Update or restart MassOrca and try again.'
      )
    }
    const title = getOptionalStringFlag(flags, 'title')
    const result = await callOrchestrationMutation<DelegateRequestResult>(
      client,
      flags,
      'orchestration.delegateRequest',
      {
        summary,
        prompt: getRequiredStringFlag(flags, 'prompt'),
        ...(title ? { title } : {}),
        ...(flags.get('writes') === true ? { writes: true } : {})
      }
    )
    printResult(
      result,
      json,
      (value) =>
        `Delegation ${value.requestId} requested [${value.status}]. A card in this chat asks the person which agent should run it; the child's result reaches you as a message when it finishes. Do not wait for it.`
    )
  }
}
