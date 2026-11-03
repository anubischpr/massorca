import { resolveUnifiedTabLabel } from '../../../../../shared/tab-title-resolution'
import type { Tab } from '../../../../../shared/tab-types'
import type { AppState } from '../../types'

/** The name a session shows in the session bar and in the new-pane picker. */
export function selectSessionTabLabel(
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
