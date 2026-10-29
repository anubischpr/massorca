import { ORCA_AGENT_SESSION_ID_ENV } from '../../shared/agent-session-caller-env'

// Free of quotes, angle brackets, pipes, ampersands, percent and caret, so a Windows .cmd shim
// carries the single-line form as one argument unchanged.
const DELEGATION_INSTRUCTION_LINES = [
  'MassOrca child sessions.',
  'When the user asks for a child session, sub-session, sesion hija, sub-sesion, or to delegate work to another session or agent, run `orca orchestration delegate --summary ABSTRACT --prompt TASK --title NAME --json` and quote each value. ABSTRACT is one line of at most 160 characters describing the kind of work, with no secrets or paths; TASK is the full task text. Add `--writes` only when the child will edit code.',
  'That command is the only way to create a child session. Never use your own subagent tools for it: not Task or Agent, not invoke_subagent (TypeName self included), not any built-in subagent or self-spawn.',
  'The command returns at once and a card in this chat asks the user which agent runs the child. Tell the user the request is waiting for their choice, then end your turn without polling.',
  'When the child finishes, its result arrives in this chat as a message. Read it and report to the user; do not redo the work.'
] as const

export const DELEGATION_AGENT_INSTRUCTIONS = DELEGATION_INSTRUCTION_LINES.join('\n')

/** The same text on one line, for a channel that carries it as a single command-line argument. */
export const DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE = DELEGATION_INSTRUCTION_LINES.join(' ')

/**
 * The text for a structured session whose child env can actually delegate: its own session id is
 * the caller, and the Orca CLI launcher resolved for it. Null leaves the agent uninstructed.
 */
export function delegationInstructionsForEnv(
  env: Readonly<Record<string, string | undefined>>,
  form: 'lines' | 'one-line' = 'lines'
): string | null {
  if (!env[ORCA_AGENT_SESSION_ID_ENV]?.trim() || !env.ORCA_CLI_COMMAND?.trim()) {
    return null
  }
  return form === 'lines' ? DELEGATION_AGENT_INSTRUCTIONS : DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE
}
