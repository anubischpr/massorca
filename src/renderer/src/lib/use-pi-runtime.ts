import { useAppStore } from '@/store'
import { piRuntimeFromCommand, type PiDisplayRuntime } from './pi-agent-display'

/** The Pi runtime the configured Pi command names; re-renders when that setting changes. */
export function usePiRuntime(): PiDisplayRuntime {
  const settingsLoaded = useAppStore((state) => state.settings !== null)
  const command = useAppStore((state) => state.settings?.agentCmdOverrides?.pi)
  return settingsLoaded ? piRuntimeFromCommand(command) : 'unknown'
}
