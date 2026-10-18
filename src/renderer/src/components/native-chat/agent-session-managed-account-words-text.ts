// Desktop words for the agent-named managed-account refusals and the agent CLI version refusal.

import { translate } from '@/i18n/i18n'
import {
  AGENT_SESSION_FAILURE_COPY as COPY,
  type AgentSessionFailureCopyId,
  type AgentSessionFailureCopyValues
} from '../../../../shared/agent-session-failure-copy'

type AgentNamedPiece = (values: AgentSessionFailureCopyValues) => string

export const AGENT_NAMED_FAILURE_PIECES: Pick<
  Record<AgentSessionFailureCopyId, AgentNamedPiece>,
  | 'managedAccountEnvOverrideAgent'
  | 'managedAccountUnsupportedAgent'
  | 'historyInOtherAccountAgent'
  | 'antigravityCliVersionUnsupported'
> = {
  managedAccountEnvOverrideAgent: (values) =>
    translate(
      'components.native-chat.failureWords.managedAccountEnvOverrideAgent',
      COPY.managedAccountEnvOverrideAgent,
      values
    ),
  managedAccountUnsupportedAgent: (values) =>
    translate(
      'components.native-chat.failureWords.managedAccountUnsupportedAgent',
      COPY.managedAccountUnsupportedAgent,
      values
    ),
  historyInOtherAccountAgent: (values) =>
    translate(
      'components.native-chat.failureWords.historyInOtherAccountAgent',
      COPY.historyInOtherAccountAgent,
      values
    ),
  antigravityCliVersionUnsupported: (values) =>
    translate(
      'components.native-chat.failureWords.antigravityCliVersionUnsupported',
      COPY.antigravityCliVersionUnsupported,
      values
    )
}
