/** What the Tasks home creates; the WorkSpaces / Bot Team switch from the canvas picks one. */
export const TASKS_HOME_CREATE_MODES = ['workspaces', 'bot-team'] as const

export type TasksHomeCreateMode = (typeof TASKS_HOME_CREATE_MODES)[number]

/** The switch follows the rail's mode when the page is entered from it. */
export function defaultTasksHomeCreateMode(
  railMode: 'workspaces' | 'bot-teams'
): TasksHomeCreateMode {
  return railMode === 'bot-teams' ? 'bot-team' : 'workspaces'
}
