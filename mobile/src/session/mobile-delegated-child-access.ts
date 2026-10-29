import { createContext } from 'react'
import type { MobileSessionTab } from './mobile-session-route-types'

/** What a chat can do about a delegated child: whether its tab is open here, and opening it. */
export type MobileDelegatedChildAccess = {
  hasChild: (childSessionId: string) => boolean
  openChild: (childSessionId: string) => void
}

/** Null where no tab list is at hand, so a notice draws no Open control rather than a dead one. */
export const MobileDelegatedChildContext = createContext<MobileDelegatedChildAccess | null>(null)

/** Access over this worktree's tabs, read when a notice asks: a child is openable only while its chat
 *  tab is one of them. */
export function mobileDelegatedChildAccess(
  readTabs: () => readonly MobileSessionTab[],
  switchTab: (tab: MobileSessionTab) => void
): MobileDelegatedChildAccess {
  const childTab = (childSessionId: string) =>
    readTabs().find((tab) => tab.type === 'agent-session' && tab.sessionId === childSessionId)
  return {
    hasChild: (childSessionId) => childTab(childSessionId) !== undefined,
    openChild: (childSessionId) => {
      const tab = childTab(childSessionId)
      if (tab) {
        switchTab(tab)
      }
    }
  }
}
