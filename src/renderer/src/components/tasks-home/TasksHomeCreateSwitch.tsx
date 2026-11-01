import { translate } from '@/i18n/i18n'
import { ViewOption } from '../create-chat/CreateChatSessionViewSwitch'
import type { TasksHomeCreateMode } from './tasks-home-create-modes'

/** The canvas switch over the Tasks composer: WorkSpaces creates a session, Bot Team a team task. */
export function TasksHomeCreateSwitch({
  mode,
  onModeChange
}: {
  mode: TasksHomeCreateMode
  onModeChange: (mode: TasksHomeCreateMode) => void
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={translate('components.tasksHome.createModeAria', 'Create')}
      className="flex gap-0.5 rounded-md bg-muted p-0.5"
    >
      <ViewOption
        label={translate('components.tasksHome.createModeWorkspaces', 'WorkSpaces')}
        checked={mode === 'workspaces'}
        onSelect={() => onModeChange('workspaces')}
      />
      <ViewOption
        label={translate('components.tasksHome.createModeBotTeam', 'Bot Team')}
        checked={mode === 'bot-team'}
        onSelect={() => onModeChange('bot-team')}
      />
    </div>
  )
}
