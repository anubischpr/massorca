import type { BackgroundTaskGroup } from '../../../src/shared/background-task-roster'

/** The strip's groups in the background sheet's two sections: subagents apart, every other kind of
 *  running work as tasks. */
export function splitBackgroundWorkSections<Group extends BackgroundTaskGroup>(
  groups: readonly Group[]
): { tasks: Group[]; agents: Group[] } {
  return {
    tasks: groups.filter((group) => group.kind !== 'agent'),
    agents: groups.filter((group) => group.kind === 'agent')
  }
}
