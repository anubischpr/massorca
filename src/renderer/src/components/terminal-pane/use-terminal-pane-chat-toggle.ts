import { useCallback } from 'react'
import {
  canReturnTerminalToStructuredChat,
  returnTerminalToStructuredChat,
  terminalChatToggleRoute
} from '../native-chat/structured-chat-terminal-return'
import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'

type TerminalPaneChatToggleInput = {
  chatLeafId: string | null
  chatReturnLink: StructuredChatTerminalLink | undefined
  effectiveChatViewMode: boolean
  isChatEligibleForLeaf: (leafId: string | null) => boolean
  paneCount: number
  setChatLeafId: (leafId: string | null) => void
  tabId: string
  toggleTabViewMode: (unifiedTabId: string) => void
  unifiedTabId: string | null | undefined
}

/** Toggle eligibility and routing between a terminal leaf and its chat view, including the structured-chat return. */
export function useTerminalPaneChatToggle({
  chatLeafId,
  chatReturnLink,
  effectiveChatViewMode,
  isChatEligibleForLeaf,
  paneCount,
  setChatLeafId,
  tabId,
  toggleTabViewMode,
  unifiedTabId
}: TerminalPaneChatToggleInput) {
  const canToggleChatForLeaf = useCallback(
    (leafId: string | null): boolean => {
      // Scope the "always allow toggling back" rule to the leaf showing chat; must not make an unsupported sibling look eligible.
      const isChatViewForLeaf = effectiveChatViewMode && leafId !== null && chatLeafId === leafId
      // Why: a single-pane terminal the structured chat opened returns to that chat; a split one keeps the legacy rule.
      const returnsToStructuredChat =
        leafId !== null && canReturnTerminalToStructuredChat({ link: chatReturnLink, paneCount })
      return isChatViewForLeaf || returnsToStructuredChat || isChatEligibleForLeaf(leafId)
    },
    [chatLeafId, effectiveChatViewMode, isChatEligibleForLeaf, paneCount, chatReturnLink]
  )
  const toggleNativeChatForLeaf = useCallback(
    (leafId: string) => {
      if (!unifiedTabId) {
        return
      }
      if (effectiveChatViewMode && chatLeafId === leafId) {
        setChatLeafId(null)
        toggleTabViewMode(unifiedTabId)
        return
      }
      const route = terminalChatToggleRoute({
        link: chatReturnLink,
        chatViewActive: effectiveChatViewMode,
        paneCount
      })
      if (route.kind === 'return-to-structured-chat') {
        void returnTerminalToStructuredChat({ tabId, link: route.link })
        return
      }
      setChatLeafId(leafId)
      if (!effectiveChatViewMode) {
        toggleTabViewMode(unifiedTabId)
      }
    },
    [
      chatLeafId,
      effectiveChatViewMode,
      paneCount,
      setChatLeafId,
      chatReturnLink,
      tabId,
      toggleTabViewMode,
      unifiedTabId
    ]
  )
  return { canToggleChatForLeaf, toggleNativeChatForLeaf }
}
