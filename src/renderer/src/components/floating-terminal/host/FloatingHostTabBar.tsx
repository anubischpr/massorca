import { useMemo } from 'react'
import TabBar from '@/components/tab-bar/TabBar'
import type { TabBarProps } from '@/components/tab-bar/tab-bar-props'
import { floatingCreateHost } from '@/lib/floating-workspace-host-session'
import { useFloatingCreateSessionStore } from '../create-session/floating-create-session-store'
import { useFloatingHostSelection } from './use-floating-host-selection'

function openFloatingCreateSession(): void {
  useFloatingCreateSessionStore.getState().setOpen(true)
}

/** The floating strip, whose "+" menu follows the host selected in the header. */
export function FloatingHostTabBar(props: Omit<TabBarProps, 'createHost'>): React.JSX.Element {
  const { selectedHost, remoteWorkspaceId } = useFloatingHostSelection()
  const createHost = useMemo(
    () => floatingCreateHost(selectedHost, remoteWorkspaceId),
    [remoteWorkspaceId, selectedHost]
  )
  // Why: sessions start through the create screen, drawn in the panel, so they belong to a real
  // workspace and its session list; the floating panel lists no agents of its own.
  return (
    <TabBar
      {...props}
      createHost={createHost}
      showAgentLaunchItems={false}
      onNewSession={openFloatingCreateSession}
    />
  )
}
