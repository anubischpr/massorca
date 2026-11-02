import { useMemo } from 'react'
import { MessageSquare, Plus, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { useAppStore } from '../../store'
import {
  closeSessionPane,
  listSessionPickerCandidates,
  moveSessionIntoPane
} from './session-picker-pane'

/**
 * What an empty main pane shows: the workspace's other sessions to put in it, the sidebar's own
 * Create entry, and a way out of the split with the mouse.
 */
export function SessionPanePicker({
  worktreeId,
  groupId
}: {
  worktreeId: string
  groupId: string
}): React.JSX.Element {
  const groups = useAppStore((s) => s.groupsByWorktree[worktreeId])
  const tabs = useAppStore((s) => s.unifiedTabsByWorktree[worktreeId])
  const terminals = useAppStore((s) => s.tabsByWorktree[worktreeId])
  const settings = useAppStore((s) => s.settings)
  const openCreateChatPage = useAppStore((s) => s.openCreateChatPage)
  const candidates = useMemo(
    () =>
      listSessionPickerCandidates(
        {
          groupsByWorktree: { [worktreeId]: groups ?? [] },
          unifiedTabsByWorktree: { [worktreeId]: tabs ?? [] },
          tabsByWorktree: { [worktreeId]: terminals ?? [] },
          settings
        },
        worktreeId
      ),
    [worktreeId, groups, tabs, terminals, settings]
  )
  const closePaneLabel = translate(
    'auto.components.tab.group.TabGroupPanel.closePaneColumn',
    'Close split pane'
  )
  return (
    <div
      data-session-pane-picker="true"
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6"
    >
      <div className="flex w-full max-w-xs flex-col gap-1.5">
        {candidates.map((candidate) => (
          <Button
            key={candidate.tabId}
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => moveSessionIntoPane(worktreeId, candidate.tabId, groupId)}
          >
            <MessageSquare className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{candidate.label}</span>
          </Button>
        ))}
        <Button type="button" size="sm" className="w-full" onClick={openCreateChatPage}>
          <Plus className="size-4 shrink-0" strokeWidth={2} />
          {translate('components.createChat.sidebarCreate', 'Create')}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2"
        aria-label={closePaneLabel}
        title={closePaneLabel}
        onClick={() => closeSessionPane(worktreeId, groupId)}
      >
        <X />
      </Button>
    </div>
  )
}
