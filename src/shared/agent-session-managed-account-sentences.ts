import type { AgentSessionFailureSay } from './agent-session-failure-copy'
import type { AgentSessionFailureWordsContext } from './agent-session-failure-words'
import { joinSentences } from './sentence-joining'
import { TUI_AGENT_DISPLAY_NAMES } from './tui-agent-display-names'

// Managed-account refusals are Claude's own words; a chat of any other agent names that agent instead.

/** Whether the words are Claude's: the chat is Claude's, or names no agent (the words it always had). */
function claudeAccountWords(context: AgentSessionFailureWordsContext): boolean {
  return context.agentName === undefined || context.agentName === TUI_AGENT_DISPLAY_NAMES.claude
}

function agentValues(say: AgentSessionFailureSay, { agentName }: AgentSessionFailureWordsContext) {
  return { agent: agentName ?? say('theAgent') }
}

export function managedAccountEnvOverrideSentence(
  context: AgentSessionFailureWordsContext,
  say: AgentSessionFailureSay
): string {
  return claudeAccountWords(context)
    ? say('managedAccountEnvOverride')
    : say('managedAccountEnvOverrideAgent', agentValues(say, context))
}

export function historyInOtherAccountSentence(
  context: AgentSessionFailureWordsContext,
  say: AgentSessionFailureSay
): string {
  return claudeAccountWords(context)
    ? say('historyInOtherAccount')
    : say('historyInOtherAccountAgent', agentValues(say, context))
}

export function managedAccountUnsupportedSentence(
  context: AgentSessionFailureWordsContext,
  say: AgentSessionFailureSay
): string {
  if (!claudeAccountWords(context)) {
    return say('managedAccountUnsupportedAgent', agentValues(say, context))
  }
  return joinSentences([
    say('managedAccountUnsupported'),
    context.retryControl || context.messageSubmitted === false
      ? say('chooseClaudeAccount')
      : context.command
        ? say('chooseClaudeAccountThenRunCommand', { command: context.command })
        : say('chooseClaudeAccountThenSend')
  ])
}
