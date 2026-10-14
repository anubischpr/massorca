/** A client's change to the thread goal. `set` replaces the objective and makes
 * it active, which the provider pursues without a separate turn. */
export type AgentSessionThreadGoalChange =
  | { kind: 'set'; objective: string }
  | { kind: 'status'; status: 'active' | 'paused' }
  | { kind: 'clear' }

export type AgentSessionThreadGoalResult = {
  change: AgentSessionThreadGoalChange['kind']
}
