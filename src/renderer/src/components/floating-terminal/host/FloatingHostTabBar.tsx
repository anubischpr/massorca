import { useMemo } from 'react'
import TabBar from '@/components/tab-bar/TabBar'
import { useAppStore } from '@/store'
import type { TabBarProps } from '@/components/tab-bar/tab-bar-props'
import { floatingCreateHost } from '@/lib/floating-workspace-host-session'
import { useFloatingHostSelection } from './use-floating-host-selection'

/** The floating strip, whose "+" menu follows the host selected in the header. */
export function FloatingHostTabBar(props: Omit<TabBarProps, 'createHost'>): React.JSX.Element {
  const { selectedHost, remoteWorkspaceId } = useFloatingHostSelection()
  const openCreateChatPage = useAppStore((state) => state.openCreateChatPage)
  const createHost = useMemo(
    () => floatingCreateHost(selectedHost, remoteWorkspaceId),
    [remoteWorkspaceId, selectedHost]
  )
  // Why: sessions start through the Workspaces create flow, so they belong to a real workspace and
  // its session list; the floating panel lists no agents of its own.
  return (
    <TabBar
      {...props}
      createHost={createHost}
      showAgentLaunchItems={false}
      onNewSession={openCreateChatPage}
    />
  )
}
