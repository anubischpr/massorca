import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import {
  FLOATING_HOST_THIS_COMPUTER,
  selectFloatingHostWorkspaceId,
  selectSelectedFloatingHost
} from '@/lib/floating-workspace-host'
import { useFloatingWorkspaceHostStore } from '@/lib/floating-workspace-host-store'

/** The floating header's host: what the select shows, and where a new session starts on it. */
export function useFloatingHostSelection(): {
  selectedHost: string
  environments: AppState['runtimeEnvironments']
  statuses: AppState['runtimeStatusByEnvironmentId']
  chooseHost: (host: string) => void
  /** The workspace a paired host's new session starts in; null for This computer or a host with none. */
  remoteWorkspaceId: string | null
  hostHasNoWorkspace: boolean
} {
  const chosen = useFloatingWorkspaceHostStore((state) => state.chosen)
  const lastUsedHost = useFloatingWorkspaceHostStore((state) => state.lastUsedHost)
  const chooseHost = useFloatingWorkspaceHostStore((state) => state.choose)
  const selectedHost = useAppStore((state) =>
    selectSelectedFloatingHost(state, { chosen, lastUsedHost })
  )
  const environments = useAppStore((state) => state.runtimeEnvironments)
  const statuses = useAppStore((state) => state.runtimeStatusByEnvironmentId)
  const remoteWorkspaceId = useAppStore((state) =>
    selectedHost === FLOATING_HOST_THIS_COMPUTER
      ? null
      : selectFloatingHostWorkspaceId(state, selectedHost)
  )
  return {
    selectedHost,
    environments,
    statuses,
    chooseHost,
    remoteWorkspaceId,
    hostHasNoWorkspace: selectedHost !== FLOATING_HOST_THIS_COMPUTER && remoteWorkspaceId === null
  }
}
