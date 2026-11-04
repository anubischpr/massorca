import { useMemo } from 'react'
import TabBar from '@/components/tab-bar/TabBar'
import type { TabBarProps } from '@/components/tab-bar/tab-bar-props'
import { floatingCreateHost } from '@/lib/floating-workspace-host-session'
import { useFloatingHostSelection } from './use-floating-host-selection'

/** The floating strip, whose "+" menu follows the host selected in the header. */
export function FloatingHostTabBar(props: Omit<TabBarProps, 'createHost'>): React.JSX.Element {
  const { selectedHost, remoteWorkspaceId } = useFloatingHostSelection()
  const createHost = useMemo(
    () => floatingCreateHost(selectedHost, remoteWorkspaceId),
    [remoteWorkspaceId, selectedHost]
  )
  return <TabBar {...props} createHost={createHost} />
}
