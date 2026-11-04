import { create } from 'zustand'

const STORAGE_KEY = 'massorca.floatingWorkspace.lastHost'

function readStoredHost(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function rememberHost(host: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, host)
  } catch {
    // The choice still holds for this session.
  }
}

export type FloatingWorkspaceHostState = {
  /** The host picked in this window; it wins over the defaults until the app restarts. */
  chosen: string | null
  /** The host a session last started on; the only value kept across restarts. */
  lastUsedHost: string | null
  choose: (host: string) => void
  markUsed: (host: string) => void
}

export const useFloatingWorkspaceHostStore = create<FloatingWorkspaceHostState>((set) => ({
  chosen: null,
  lastUsedHost: readStoredHost(),
  choose: (host) => {
    rememberHost(host)
    set({ chosen: host, lastUsedHost: host })
  },
  markUsed: (host) => {
    rememberHost(host)
    set({ lastUsedHost: host })
  }
}))
