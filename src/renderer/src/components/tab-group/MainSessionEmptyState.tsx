import { Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { useAppStore } from '../../store'
import { isSessionTab } from '../../store/slices/tabs/side-panel-group'

/**
 * What the main area shows for a workspace that has no session: the sidebar's own Create entry,
 * with its label, so a session can start without hunting for the sidebar.
 */
export function MainSessionEmptyState({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const hasSession = useAppStore((s) =>
    (s.unifiedTabsByWorktree[worktreeId] ?? []).some(isSessionTab)
  )
  const openCreateChatPage = useAppStore((s) => s.openCreateChatPage)
  if (hasSession) {
    return null
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Button type="button" size="sm" onClick={openCreateChatPage}>
        <Plus className="size-4 shrink-0" strokeWidth={2} />
        {translate('components.createChat.sidebarCreate', 'Create')}
      </Button>
    </div>
  )
}
