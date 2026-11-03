import StatusIndicator from '@/components/sidebar/StatusIndicator'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamSentRequest } from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { BotTeamTaskStatusPlaceholder } from './BotTeamTaskCard'
import { botTeamTaskGlyph, botTeamTaskLabel } from './bot-team-task-status-display'

/** A request this room sent to another team: that team's character, the task, its live status and a way in. */
export function BotTeamRequestTracker({
  request,
  team,
  status,
  offline,
  onOpen
}: {
  request: BotTeamSentRequest
  /** The team that holds the task. */
  team: BotTeam
  status: BotTeamTaskStatus
  offline: boolean
  onOpen: () => void
}): React.JSX.Element {
  return (
    <div
      data-bot-team-request-tracker
      className="flex items-center gap-3 rounded-lg border border-border p-3"
    >
      <BotTeamCharacterIcon character={team.character} size={20} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{request.task.title}</div>
        <div className="truncate text-xs text-muted-foreground">{team.name}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {status === 'Unknown' ? (
          <BotTeamTaskStatusPlaceholder />
        ) : (
          <>
            <StatusIndicator status={botTeamTaskGlyph(status)} showTooltip={false} />
            {botTeamTaskLabel(status)}
          </>
        )}
      </span>
      <Button variant="outline" size="sm" disabled={offline} onClick={onOpen}>
        {translate('components.botTeams.openInTeam', 'Open in {{team}}', { team: team.name })}
      </Button>
    </div>
  )
}

/** The trackers of the requests that went to other teams; a request whose team is not known is left out. */
export function BotTeamSentTrackers({
  requests,
  teams,
  statusOf,
  offline,
  onOpenTeam
}: {
  requests: readonly BotTeamSentRequest[]
  teams: readonly BotTeam[]
  statusOf: (task: BotTeamSentRequest['task']) => BotTeamTaskStatus
  offline: boolean
  onOpenTeam?: (teamId: string, taskId: string | null) => void
}): React.JSX.Element {
  return (
    <>
      {requests.map((request) => {
        const holder = teams.find((entry) => entry.id === request.task.teamId)
        return holder ? (
          <BotTeamRequestTracker
            key={request.task.id}
            request={request}
            team={holder}
            status={statusOf(request.task)}
            offline={offline}
            onOpen={() =>
              onOpenTeam?.(holder.id, request.task.sessionId === null ? null : request.task.id)
            }
          />
        ) : null
      })}
    </>
  )
}
