import { createContext } from 'react'
import type { MobileSessionTab } from './mobile-session-route-types'

/** The worktree and pane a delegated child's chat runs in, when this worktree holds no tab for it. */
export type DelegatedChildLocation = { worktreeId: string; paneKey: string }

/** The host's worktree rows, read for a child that lives in another worktree. */
export type DelegatedChildElsewhere = {
  locate: (childSessionId: string) => DelegatedChildLocation | null
  open: (location: DelegatedChildLocation) => void
  refresh: () => void
}

/** What a chat can do about a delegated child: whether it has a real target here, and opening it. */
export type MobileDelegatedChildAccess = {
  hasChild: (childSessionId: string) => boolean
  openChild: (childSessionId: string) => void
  /** Absent where no host rows back the chat, so a notice asks for none. */
  refreshAgentRows?: () => void
}

/** Null where no tab list is at hand, so a notice draws no Open control rather than a dead one. */
export const MobileDelegatedChildContext = createContext<MobileDelegatedChildAccess | null>(null)

/** Access over this worktree's tabs, read when a notice asks: a child is openable while its chat tab
 *  is one of them, or while the host lists its pane in another worktree. */
export function mobileDelegatedChildAccess(
  readTabs: () => readonly MobileSessionTab[],
  switchTab: (tab: MobileSessionTab) => void,
  elsewhere?: DelegatedChildElsewhere
): MobileDelegatedChildAccess {
  const childTab = (childSessionId: string) =>
    readTabs().find((tab) => tab.type === 'agent-session' && tab.sessionId === childSessionId)
  const locateElsewhere = (childSessionId: string) => elsewhere?.locate(childSessionId) ?? null
  return {
    hasChild: (childSessionId) =>
      childTab(childSessionId) !== undefined || locateElsewhere(childSessionId) !== null,
    openChild: (childSessionId) => {
      const tab = childTab(childSessionId)
      if (tab) {
        switchTab(tab)
        return
      }
      const location = locateElsewhere(childSessionId)
      if (location && elsewhere) {
        elsewhere.open(location)
      }
    },
    refreshAgentRows: elsewhere?.refresh
  }
}
