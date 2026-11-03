import { useAppStore } from '@/store'

/** `/resume` and `/session` from a room: Bot teams' own sidebar has no Sessions tab, so go to the workspace. */
export function openBotTeamRoomSessions(): void {
  const state = useAppStore.getState()
  state.setActiveView('terminal')
  state.setRightSidebarTab('vault')
  state.setRightSidebarOpen(true)
}
