import { translate } from '@/i18n/i18n'
import { parseAgentSessionWriteFailure } from '../../../../shared/agent-session-write-failure'
import { RuntimeRpcCallError } from '../../runtime/runtime-rpc-result'
import { agentSessionWriteFailureText } from './agent-session-write-notice-text'

/** The toast for a chat that stayed open because its agent could not be released: the fixed sentence,
 *  then the reason the host refused the release, when the refusal named one. */
export function structuredChatReleaseFailureNotice(error: unknown): string {
  const base = translate(
    'components.native-chat.toggle.terminalViewReleaseFailed',
    'Could not open this chat in the terminal. The chat was left open.'
  )
  const failure = refusalOfReleaseError(error)
  return failure ? `${base} ${agentSessionWriteFailureText(failure, 'stop')}` : base
}

function refusalOfReleaseError(error: unknown) {
  if (!(error instanceof RuntimeRpcCallError)) {
    return undefined
  }
  const data: unknown = error.response.error.data
  if (typeof data !== 'object' || data === null || !('refusal' in data)) {
    return undefined
  }
  const refusal: unknown = data.refusal
  return typeof refusal === 'object' && refusal !== null
    ? parseAgentSessionWriteFailure({ kind: 'refused', ...refusal })
    : undefined
}
