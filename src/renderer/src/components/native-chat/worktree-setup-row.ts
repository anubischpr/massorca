import { translate } from '@/i18n/i18n'
import type { AgentChildRowModel } from '../../../../shared/agent-child-row-model'
import { agentChildRunStateFor } from '../../../../shared/agent-status-child-work-display'
import type { BackgroundTaskGroup } from '../../../../shared/background-task-roster'

/** An Orca setup row in the strip's words: its name, and its failure when the setup exited non-zero. */
export function presentWorktreeSetupRow(row: AgentChildRowModel): AgentChildRowModel {
  if (row.origin !== 'orca') {
    return row
  }
  const name = translate('components.native-chat.backgroundTasks.setupRowName', 'Worktree setup')
  const failed = row.settled && row.exitCode !== undefined && row.exitCode !== 0
  if (!failed) {
    return { ...row, name }
  }
  return {
    ...row,
    name,
    displayState: 'failed',
    detail: {
      kind: 'message',
      text: translate(
        'components.native-chat.backgroundTasks.setupFailed',
        'Failed with exit code {{value0}}',
        { value0: String(row.exitCode) }
      )
    }
  }
}

/** Presents every Orca row in the groups, leaving the provider's rows as they are. */
export function presentWorktreeSetupGroups(groups: BackgroundTaskGroup[]): BackgroundTaskGroup[] {
  return groups.map((group) => ({
    ...group,
    tasks: group.tasks.map((entry) => {
      if (entry.row.origin !== 'orca') {
        return entry
      }
      const row = presentWorktreeSetupRow(entry.row)
      return { row, state: agentChildRunStateFor(row.displayState) }
    })
  }))
}
