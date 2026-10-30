import { useStructuredChatTabConversationName } from '@/runtime/structured-conversation-name'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'

function delegatedChildTab(
  unifiedTabsByWorktree: Readonly<Record<string, readonly Tab[]>>,
  childSessionId: string | null
): Tab | undefined {
  if (childSessionId === null) {
    return undefined
  }
  // A new-child placement lives in another worktree, so look in every worktree.
  for (const tabs of Object.values(unifiedTabsByWorktree)) {
    const tab = tabs.find(
      (candidate) => candidate.contentType === 'agent-session' && candidate.entityId === childSessionId
    )
    if (tab) {
      return tab
    }
  }
  return undefined
}

/** The child chat's generated name once its host has one, else the title it was delegated with. */
export function useDelegatedChildTitle(childSessionId: string | null, title: string): string {
  const tab = useAppStore((state) => delegatedChildTab(state.unifiedTabsByWorktree, childSessionId))
  return useStructuredChatTabConversationName(tab) ?? title
}
