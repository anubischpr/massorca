import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { upcomingOnceRoutines, routineWhenLabel } from './BotTeamRoutineLabels'
import { useBotTeamRoutines } from './BotTeamRoutines'
import { BotTeamTaskStatusPlaceholder } from './BotTeamTaskCard'
import { BotTeamViewHeader as ViewHeader } from './BotTeamViewHeader'
import { keepSessionStatuses } from './bot-team-project-board-cache'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { useKeptTeamWork } from './use-bot-team-work'

/** Every task of the team, with or without a project. */
export function BotTeamBoard({
  team,
  onBack,
  onOpenTask
}: {
  team: BotTeam
  onBack: () => void
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const { tasks, projects } = useKeptTeamWork(team.id)
  const { routines } = useBotTeamRoutines(team.id)
  const statuses = useBotTeamSessionStatuses()
  useEffect(() => keepSessionStatuses(statuses), [statuses])
  // null: all; 'none': without a project; otherwise a project id.
  const [filter, setFilter] = useState<string | null>(null)
  const shown = tasks.filter((task) =>
    filter === null ? true : filter === 'none' ? task.projectId === null : task.projectId === filter
  )
  // A scheduled run makes its task without a project, so it shows with the tasks that have none.
  const scheduled =
    Array.isArray(routines) && (filter === null || filter === 'none')
      ? upcomingOnceRoutines(routines)
      : []
  const chips = [
    { id: null, name: translate('components.botTeams.allTasks', 'All') },
    ...projects.map((project) => ({ id: project.id, name: project.name })),
    { id: 'none', name: translate('components.botTeams.noProject', 'No project') }
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={translate('components.botTeams.board', 'Board')}
        detail={translate('components.botTeams.boardDetail', '{{team}}, all tasks', {
          team: team.name
        })}
        onBack={onBack}
      />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Button
                key={chip.id ?? 'all'}
                variant={chip.id === filter ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilter(chip.id)}
              >
                {chip.name}
              </Button>
            ))}
          </div>
          <div className="flex flex-col rounded-xl border border-border bg-card">
            {scheduled.map((routine) => {
              const owner = team.bots.find((bot) => bot.id === routine.botId)
              return (
                <div
                  key={routine.id}
                  className="flex w-full items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <AgentIcon agent={owner?.agent} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{routine.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {owner?.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {translate('components.botTeams.scheduledFor', 'Scheduled, {{when}}', {
                      when: routineWhenLabel(routine.nextRun, routine.nextRunAt)
                    })}
                  </span>
                </div>
              )
            })}
            {shown.map((task) => {
              const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
              const status = botTeamTaskStatus(
                task.sessionId,
                task.sessionId === null ? undefined : statuses.get(task.sessionId),
                task.awaitingPerson === true
              )
              return (
                <button
                  key={task.id}
                  type="button"
                  disabled={task.sessionId === null}
                  onClick={() => onOpenTask(task.id)}
                  className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left first:border-t-0 hover:bg-muted"
                >
                  <AgentIcon agent={owner?.agent} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {owner?.name}
                    </span>
                  </span>
                  {task.projectId ? (
                    <Badge variant="secondary">
                      {projects.find((project) => project.id === task.projectId)?.name}
                    </Badge>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {status === 'Unknown' ? <BotTeamTaskStatusPlaceholder /> : status}
                  </span>
                </button>
              )
            })}
            {shown.length === 0 && scheduled.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {translate('components.botTeams.noTasksHere', 'No tasks here.')}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.boardHelp',
              'Every task of this team, including those without a project. Use the chips to filter by project.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
