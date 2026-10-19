import type { AgentSessionArgumentProblem } from '../../shared/agent-session-failure'
import { StructuredAgentArgumentsError } from './structured-agent-arguments-error'

export type StructuredPassthroughOwnedFlags = {
  /** Orca-owned options that take one value; dropped with it. */
  valueFlags: ReadonlySet<string>
  /** Orca-owned switches; dropped alone. */
  switches: ReadonlySet<string>
}

/**
 * Keeps the saved terminal Arguments a structured launch may pass through. Options Orca owns
 * (transport, session, permission) are dropped like the Claude and Codex lanes do; a positional
 * prompt would change what the process does, so it is refused.
 */
export function structuredPassthroughLaunchArgs(
  agent: AgentSessionArgumentProblem['agent'],
  tokens: readonly string[],
  owned: StructuredPassthroughOwnedFlags
): string[] {
  const kept: string[] = []
  // What the next bare (non-dash) token belongs to: one value of the last kept or dropped option, or nothing.
  let operand: 'kept' | 'drop-one' | 'none' = 'none'
  for (const token of tokens) {
    if (token === '--') {
      break
    }
    if (token.startsWith('-') && token.length > 1) {
      const name = token.split('=', 1)[0]!
      const inline = token.includes('=')
      if (owned.valueFlags.has(name)) {
        operand = inline ? 'none' : 'drop-one'
      } else if (owned.switches.has(name)) {
        operand = 'none'
      } else {
        kept.push(token)
        operand = inline ? 'none' : 'kept'
      }
      continue
    }
    if (operand === 'kept') {
      kept.push(token)
      operand = 'none'
    } else if (operand === 'drop-one') {
      operand = 'none'
    } else {
      throw new StructuredAgentArgumentsError(agent, 'prompt', 'positionalPrompt')
    }
  }
  return kept
}
