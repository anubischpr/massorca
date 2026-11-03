import type { Tab } from '../../../shared/tab-types'
import { resolveUnifiedTabLabel } from '../../../shared/tab-title-resolution'
import type { AppState } from '../store/types'

/** The name a session tab carries in the session bar and in its own pane row. */
export function sessionTabTitle(
  state: Pick<AppState, 'tabsByWorktree' | 'settings'>,
  worktreeId: string,
  tab: Tab
): string {
  const terminal =
    tab.contentType === 'terminal'
      ? state.tabsByWorktree[worktreeId]?.find((row) => row.id === tab.entityId)
      : undefined
  return resolveUnifiedTabLabel(
    {
      ...tab,
      quickCommandLabel: tab.quickCommandLabel ?? terminal?.quickCommandLabel,
      generatedLabel: tab.generatedLabel ?? terminal?.generatedTitle
    },
    state.settings?.tabAutoGenerateTitle === true,
    tab.label
  )
}
