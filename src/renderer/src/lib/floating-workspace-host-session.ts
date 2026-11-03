import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { focusTerminalTabSurface } from './focus-terminal-tab-surface'
import { showSessionInFloatingWorkspace } from './show-session-in-floating-workspace'

/** Shows a session that runs on a paired host in the floating workspace; a refusal is said out loud. */
export function showHostSessionInFloating(worktreeId: string, tabId: string): boolean {
  const shown = showSessionInFloatingWorkspace({ worktreeId, tabId }, useAppStore)
  if (!shown.ok) {
    toast.error(
      translate(
        'components.floatingWorkspace.couldNotShow',
        'Could not show this session in the floating workspace.'
      )
    )
    return false
  }
  focusTerminalTabSurface(tabId)
  return true
}
