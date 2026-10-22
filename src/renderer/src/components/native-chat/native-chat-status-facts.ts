import { translate } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { SessionOptionDescriptor } from '../../../../shared/native-chat-session-options'
import type { StructuredAgentContextSummary } from '../../../../shared/structured-agent-session-context-usage'
import {
  formatContextPercentage,
  formatContextTokenCount
} from './native-chat-context-usage-summary'
import {
  nativeChatModelPillLabel,
  nativeChatSessionChoiceLabel
} from './native-chat-session-option-labels'

export type NativeChatStatusFact = { label: string; value: string }

function notReported(): string {
  return translate('components.native-chat.commands.notReported', 'Not reported')
}

function selectedChoiceLabel(descriptor: SessionOptionDescriptor | undefined): string | null {
  if (!descriptor || descriptor.kind.type !== 'select') {
    return null
  }
  const { choices, currentValue } = descriptor.kind
  const choice = choices.find((entry) => entry.value === currentValue)
  return choice ? nativeChatSessionChoiceLabel(choice) : null
}

function contextText(context: StructuredAgentContextSummary | null): string {
  if (!context) {
    return notReported()
  }
  const tokens = `${formatContextTokenCount(context.usedTokens)} ${translate('components.nativeChatSummary.tokens', 'tokens')}`
  if (context.percentage === null) {
    return tokens
  }
  const estimate = context.estimated ? '~' : ''
  return `${estimate}${formatContextPercentage(context.percentage)}% (${tokens})`
}

/** The facts `/status` reports, from what the chat already holds: no request to the agent. */
export function nativeChatStatusFacts(input: {
  agent: AgentType
  sessionId: string
  workspacePath: string | null
  snapshot: readonly SessionOptionDescriptor[]
  context: StructuredAgentContextSummary | null
}): NativeChatStatusFact[] {
  const { snapshot } = input
  const model = snapshot.find((entry) => entry.category === 'model')
  return [
    {
      label: translate('components.native-chat.commands.statusAgent', 'Agent'),
      value: structuredAgentLabel(input.agent)
    },
    {
      label: translate('components.native-chat.commands.statusModel', 'Model'),
      value: model ? nativeChatModelPillLabel(model) : notReported()
    },
    {
      label: translate('components.native-chat.commands.statusEffort', 'Reasoning effort'),
      value: selectedChoiceLabel(snapshot.find((entry) => entry.id === 'effort')) ?? notReported()
    },
    {
      label: translate('components.native-chat.commands.statusAccess', 'Access'),
      value:
        selectedChoiceLabel(snapshot.find((entry) => entry.id === 'accessMode')) ?? notReported()
    },
    {
      label: translate('components.native-chat.commands.statusWorkspace', 'Workspace'),
      value: input.workspacePath ?? notReported()
    },
    {
      label: translate('components.native-chat.commands.statusSession', 'Chat session'),
      value: input.sessionId
    },
    {
      label: translate('components.nativeChatSummary.context', 'Context'),
      value: contextText(input.context)
    }
  ]
}
