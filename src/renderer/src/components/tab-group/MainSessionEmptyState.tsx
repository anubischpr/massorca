import { useAppStore } from '../../store'
import { isSessionTab } from '../../store/slices/tabs/side-panel-group'
import CreateChatPage from '../create-chat/CreateChatPage'
import { submitCreateChatDraft } from '../create-chat/create-chat-submit'

/**
 * What the main area shows for a workspace that has no session: the create-chat page itself, so a
 * session starts from the first screen instead of behind a Create button.
 */
export function MainSessionEmptyState({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const hasSession = useAppStore((s) =>
    (s.unifiedTabsByWorktree[worktreeId] ?? []).some(isSessionTab)
  )
  if (hasSession) {
    return null
  }
  return (
    <div className="absolute inset-0 flex min-h-0 flex-col bg-chat-canvas">
      <CreateChatPage onSubmit={submitCreateChatDraft} />
    </div>
  )
}
