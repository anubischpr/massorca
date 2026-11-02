import type { AppState } from '@/store/types'
import { getIndexedRepoMap, getIndexedWorktreeMap } from '@/store/worktree-repo-index'
import { isFolderRepo } from '../../../shared/repo-kind'

type ActiveView = AppState['activeView']

const RIGHT_SIDEBAR_SUPPRESSED_VIEWS = new Set<ActiveView>([
  'settings',
  'tasks',
  'activity',
  'automations',
  'space',
  'skills',
  'artifacts',
  'prototypes',
  'mobile',
  'create-chat'
])

/** In Bot teams the sidebar is a Conference room's Tasks and Bots; anywhere else there it has nothing. */
export function botTeamsRoomOpen(selection: AppState['botTeamsSelection']): boolean {
  return selection.teamId !== null && selection.taskId === null && !selection.creating
}

export function canShowRightSidebarForView(
  activeView: ActiveView,
  botTeamsSelection: AppState['botTeamsSelection']
): boolean {
  if (activeView === 'bot-teams') {
    return botTeamsRoomOpen(botTeamsSelection)
  }
  return !RIGHT_SIDEBAR_SUPPRESSED_VIEWS.has(activeView)
}

/** The room's panel opens and closes on its own, so it never changes a workspace's sidebar. */
export function rightSidebarOpenInView(
  state: Pick<AppState, 'activeView' | 'rightSidebarOpen' | 'botTeamsPanelOpen'>
): boolean {
  return state.activeView === 'bot-teams' ? state.botTeamsPanelOpen : state.rightSidebarOpen
}

export function rightSidebarShowsPullRequestData(
  state: Pick<
    AppState,
    | 'activeView'
    | 'activeWorktreeId'
    | 'botTeamsSelection'
    | 'repos'
    | 'rightSidebarOpen'
    | 'rightSidebarTab'
    | 'worktreesByRepo'
  >
): boolean {
  if (
    !canShowRightSidebarForView(state.activeView, state.botTeamsSelection) ||
    !state.rightSidebarOpen ||
    (state.rightSidebarTab !== 'checks' && state.rightSidebarTab !== 'source-control')
  ) {
    return false
  }

  const activeWorktree = state.activeWorktreeId
    ? getIndexedWorktreeMap(state.worktreesByRepo).get(state.activeWorktreeId)
    : undefined
  const activeRepo = activeWorktree
    ? getIndexedRepoMap(state.repos).get(activeWorktree.repoId)
    : null
  if (!activeRepo || isFolderRepo(activeRepo)) {
    return false
  }

  return true
}
