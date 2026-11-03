import { create } from 'zustand'
import { useAppStore } from '@/store'
import type { RuntimeClientTarget } from './runtime-client-target'

const STORAGE_KEY = 'massorca.botTeams.host'
/** The chosen value for this computer; any other value is a paired server's environment id. */
export const BOT_TEAM_LOCAL_HOST = 'local'

function readStoredHost(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export const useBotTeamHostStore = create<{
  chosen: string | null
  choose: (host: string) => void
}>((set) => ({
  chosen: readStoredHost(),
  choose: (host) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, host)
    } catch {
      // The choice still holds for this session.
    }
    set({ chosen: host })
  }
}))

/**
 * Which host holds this window's teams. Teams live on one host, and a phone reads the server it is
 * paired with, so a paired server wins over this computer unless the person chose otherwise.
 */
export function resolveBotTeamHost(args: {
  chosen: string | null
  activeEnvironmentId: string | null | undefined
  environmentIds: readonly string[]
}): string {
  const { chosen, activeEnvironmentId, environmentIds } = args
  if (chosen === BOT_TEAM_LOCAL_HOST || (chosen && environmentIds.includes(chosen))) {
    return chosen
  }
  return activeEnvironmentId?.trim() || environmentIds[0] || BOT_TEAM_LOCAL_HOST
}

export function botTeamHostTarget(host: string): RuntimeClientTarget {
  return host === BOT_TEAM_LOCAL_HOST
    ? { kind: 'local' }
    : { kind: 'environment', environmentId: host }
}

/** The host for a call made outside React. */
export function currentBotTeamHost(): string {
  const state = useAppStore.getState()
  return resolveBotTeamHost({
    chosen: useBotTeamHostStore.getState().chosen,
    activeEnvironmentId: state.settings?.activeRuntimeEnvironmentId,
    environmentIds: state.runtimeEnvironments.map((environment) => environment.id)
  })
}

/** The host this window shows, following both the person's choice and the known servers. */
export function useBotTeamHost(): string {
  const chosen = useBotTeamHostStore((state) => state.chosen)
  const activeEnvironmentId = useAppStore((state) => state.settings?.activeRuntimeEnvironmentId)
  const environments = useAppStore((state) => state.runtimeEnvironments)
  return resolveBotTeamHost({
    chosen,
    activeEnvironmentId,
    // A store not yet hydrated (or a partial test store) has no environments list.
    environmentIds: (environments ?? []).map((environment) => environment.id)
  })
}
