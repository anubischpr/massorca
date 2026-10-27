import { useCallback } from 'react'
import { useAppStore } from '@/store'
import type { RightSidebarVisualRoute } from '@/store/slices/editor/actions/right-sidebar-state'
import type { NativeChatVisualOwner } from './native-chat-visual-owner'

export type NativeChatVisualRef = Pick<RightSidebarVisualRoute, 'messageId' | 'file' | 'title'>

/** Opens one chat visual in the right sidebar, the same route for an inline visual and a Results row. */
export function useOpenNativeChatVisual(
  owner: NativeChatVisualOwner | null
): (visual: NativeChatVisualRef) => void {
  const openRightSidebarVisual = useAppStore((state) => state.openRightSidebarVisual)
  return useCallback(
    ({ messageId, file, title }: NativeChatVisualRef) => {
      if (!owner) {
        return
      }
      openRightSidebarVisual({
        target: owner.target,
        sessionId: owner.sessionId,
        tabId: owner.tabId,
        worktreeId: owner.worktreeId,
        messageId,
        file,
        title
      })
    },
    [openRightSidebarVisual, owner]
  )
}
