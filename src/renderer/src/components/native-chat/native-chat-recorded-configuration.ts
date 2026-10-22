import type { AgentChildRowModel } from '../../../../shared/agent-child-row-model'

/** The recorded model and effort a subagent row states; an unreported part is left out, not named. */
export function recordedConfigurationText(row: Pick<AgentChildRowModel, 'recordedConfiguration'>) {
  const { model, effort } = row.recordedConfiguration ?? {}
  return [model, effort].filter(Boolean).join(' · ')
}
