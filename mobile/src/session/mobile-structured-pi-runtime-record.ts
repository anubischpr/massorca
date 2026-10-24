import { useSyncExternalStore } from 'react'
import type { PiRowRuntime } from '../../../src/shared/agent-type-label'
import {
  mobilePiRuntimeFromMarker,
  type MobilePiRuntimeMarker
} from '../components/mobile-pi-runtime'

// Why: a host from before the chat-tab marker never marks a tab, but its `agentSession.options`
// names the runtime it recorded; remembering that per chat keeps Gentle Shell's identity on the
// tab strip and in the chat against either host.
const gentleShellSessionIds = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Records the Pi runtime a host reported for a chat; an absent or unknown value changes nothing. */
export function rememberMobileStructuredPiRuntime(sessionId: string, piRuntime: unknown): void {
  if (piRuntime !== 'pi' && piRuntime !== 'gentle-shell') {
    return
  }
  const isGentleShell = piRuntime === 'gentle-shell'
  if (isGentleShell === gentleShellSessionIds.has(sessionId)) {
    return
  }
  if (isGentleShell) {
    gentleShellSessionIds.add(sessionId)
  } else {
    gentleShellSessionIds.delete(sessionId)
  }
  version += 1
  for (const listener of listeners) {
    listener()
  }
}

/** A chat tab's Pi runtime: the host's marker, else the runtime its options reported, else stock Pi. */
export function resolveMobileChatTabPiRuntime(
  tab: MobilePiRuntimeMarker & { sessionId?: string | null }
): PiRowRuntime {
  if (mobilePiRuntimeFromMarker(tab) === 'gentle-shell') {
    return 'gentle-shell'
  }
  return tab.sessionId && gentleShellSessionIds.has(tab.sessionId) ? 'gentle-shell' : 'pi'
}

/** The open chat's Pi runtime for its copy; undefined for a chat that is not Pi. Re-renders on a recorded change. */
export function useMobileChatPiRuntime(
  chat: (MobilePiRuntimeMarker & { sessionId?: string | null }) | null
): PiRowRuntime | undefined {
  useMobileStructuredPiRuntimeVersion()
  return chat?.piRuntime ? resolveMobileChatTabPiRuntime(chat) : undefined
}

/** Re-renders the caller when a recorded runtime changes. */
export function useMobileStructuredPiRuntimeVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function resetMobileStructuredPiRuntimesForTests(): void {
  gentleShellSessionIds.clear()
  version += 1
}
