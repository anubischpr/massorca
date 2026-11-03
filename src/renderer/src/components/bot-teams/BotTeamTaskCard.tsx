import { Play } from 'lucide-react'
import StatusIndicator from '@/components/sidebar/StatusIndicator'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotAgentIcon } from './BotAgentIcon'
import { botTeamTaskGlyph, botTeamTaskLabel } from './bot-team-task-status-display'

const NO_PROJECT = 'none'

/** A task in the room: its owner, status and project; the card turns orange while it waits for the person. */
export function BotTeamTaskCard({
  task,
  owner,
  status,
  projects,
  offline,
  reassign,
  onMove,
  onStart,
  onOpen
}: {
  task: BotTeamTask
  owner: BotTeam['bots'][number] | undefined
  status: BotTeamTaskStatus
  projects: readonly BotTeamProject[]
  offline: boolean
  /** Reassign, offered while the task is idle. */
  reassign: React.ReactNode
  /** The project id the task moves to, or `none`. */
  onMove: (projectId: string) => void
  onStart: () => void
  onOpen: () => void
}): React.JSX.Element {
  return (
    <div
      data-bot-team-task-card
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        status === 'Waiting for you' ? 'border-agent-question' : 'border-border'
      )}
    >
      <BotAgentIcon agent={owner?.agent} size={20} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{task.title}</div>
        <div className="truncate text-xs text-muted-foreground">{owner?.name}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <StatusIndicator status={botTeamTaskGlyph(status)} showTooltip={false} />
        {botTeamTaskLabel(status)}
        {offline && task.sessionId !== null
          ? translate('components.botTeams.cannotConfirm', ', can’t confirm now')
          : ''}
      </span>
      {projects.length > 0 ? (
        <Select value={task.projectId ?? NO_PROJECT} disabled={offline} onValueChange={onMove}>
          <SelectTrigger
            size="sm"
            aria-label={translate('components.botTeams.projectForTask', 'Project for this task')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROJECT}>
              {translate('components.botTeams.noProject', 'No project')}
            </SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {reassign}
      {task.sessionId === null ? (
        <Button variant="outline" size="sm" disabled={offline} onClick={onStart}>
          <Play className="size-3.5" />
          {translate('components.botTeams.start', 'Start')}
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={offline} onClick={onOpen}>
          {translate('components.botTeams.open', 'Open')}
        </Button>
      )}
    </div>
  )
}
