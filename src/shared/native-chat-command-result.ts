import { GENTLE_SHELL_USAGE_PRESENTATION } from './gentle-shell-usage-presentation'

/** A slash command's output as a status row, from any provider. */
export const AGENT_SESSION_COMMAND_RESULT_PRESENTATION = 'command-result'

/** Rows that are what a command printed: a turn that only ran a command shows them, not folds them. */
export function isNativeChatCommandResultPresentation(presentation: string | undefined): boolean {
  return (
    presentation === AGENT_SESSION_COMMAND_RESULT_PRESENTATION ||
    presentation === 'command-output' ||
    presentation === GENTLE_SHELL_USAGE_PRESENTATION
  )
}
