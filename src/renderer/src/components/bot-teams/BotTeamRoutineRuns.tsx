import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatusIndicator from '@/components/sidebar/StatusIndicator'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { listBotTeamRoutineRuns } from '@/runtime/runtime-bot-team-client-routines'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamRoutine,
  BotTeamRoutineRun
} from '../../../../shared/rpc-contract/bot-team-routine-params'
import { BotAgentIcon } from './BotAgentIcon'
import {
  routineAccessLabel,
  routineRunStatus,
  routineScheduleLine,
  routineWhenLabel,
  isPastOnceRoutine
} from './BotTeamRoutineLabels'
import { BotTeamRoutineSwitch, useBotTeamRoutines } from './BotTeamRoutines'
import { BotTeamViewHeader } from './BotTeamViewHeader'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { useTeamWork } from './use-bot-team-work'

function DetailRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm first:border-t-0">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  )
}

function RunsList({
  team,
  routine,
  onOpenTask
}: {
  team: BotTeam
  routine: BotTeamRoutine
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const [runs, setRuns] = useState<BotTeamRoutineRun[] | 'unavailable' | null>(null)
  const { tasks } = useTeamWork(team.id)
  const statuses = useBotTeamSessionStatuses()
  const load = useCallback(() => {
    let closed = false
    void listBotTeamRoutineRuns(routine.id).then(
      (listed) => !closed && setRuns(listed),
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [routine.id])
  useEffect(load, [load])
  if (runs === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate('components.botTeams.routinesUnavailable', 'This host cannot run routines yet.')}
      </p>
    )
  }
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      {(runs ?? []).map((run) => {
        const status = routineRunStatus(run, tasks, statuses)
        const { taskId } = run
        const task = tasks.find((entry) => entry.id === taskId)
        return (
          <div
            key={run.id}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {routineWhenLabel(run.scheduledFor, run.scheduledAt)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {run.error ??
                  (task
                    ? translate(
                        'components.botTeams.routineMadeTask',
                        'Made the task “{{task}}”.',
                        {
                          task: task.title
                        }
                      )
                    : translate('components.botTeams.routineMadeATask', 'Made a task.'))}
              </span>
            </span>
            {status ? (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <StatusIndicator status={status.glyph} showTooltip={false} />
                {status.label}
              </span>
            ) : null}
            {taskId !== null ? (
              <Button variant="outline" size="xs" onClick={() => onOpenTask(taskId)}>
                {translate('components.botTeams.routineOpenTask', 'Open task')}
              </Button>
            ) : null}
          </div>
        )
      })}
      {runs !== null && runs.length === 0 ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          {translate('components.botTeams.routineNoRuns', 'It has not run yet.')}
        </div>
      ) : null}
    </div>
  )
}

/** One routine (board 42): how it runs, the switch, and every run with its task. */
export function BotTeamRoutineRuns({
  team,
  routineId,
  onBack,
  onOpenTask
}: {
  team: BotTeam
  routineId: string
  onBack: () => void
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const { routines, replace } = useBotTeamRoutines(team.id)
  const routine = Array.isArray(routines)
    ? routines.find((entry) => entry.id === routineId)
    : undefined
  const bot = team.bots.find((entry) => entry.id === routine?.botId)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamViewHeader
        title={routine?.name ?? ''}
        detail={team.name}
        backLabel={translate('components.botTeams.routines', 'Routines')}
        onBack={onBack}
        trailing={routine ? <BotTeamRoutineSwitch routine={routine} onChanged={replace} /> : null}
      />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {routine ? (
          <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
            <div>
              <h1 className="text-xl font-semibold">{routine.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{routine.prompt}</p>
            </div>
            <div className="flex flex-col rounded-xl border border-border bg-card">
              <DetailRow label={translate('components.botTeams.routineWhen', 'When')}>
                {routineScheduleLine(routine.schedule)}
              </DetailRow>
              <DetailRow label={translate('components.botTeams.routineBot', 'Bot')}>
                <BotAgentIcon agent={bot?.agent} size={16} />
                {bot?.name ?? ''}
              </DetailRow>
              <DetailRow label={translate('components.botTeams.routineAccess', 'Access')}>
                {translate('components.botTeams.routineAccessSet', '{{access}}, set for {{team}}', {
                  access: routineAccessLabel(team),
                  team: team.name
                })}
              </DetailRow>
              <DetailRow label={translate('components.botTeams.routineNext', 'Next run')}>
                {routine.nextRun
                  ? routineWhenLabel(routine.nextRun, routine.nextRunAt)
                  : isPastOnceRoutine(routine)
                    ? translate('components.botTeams.routineOnceNoNext', 'None. It ran once.')
                    : translate('components.botTeams.routinePausedLine', 'Paused.')}
              </DetailRow>
            </div>
            <h2 className="text-lg font-semibold">
              {translate('components.botTeams.routineRuns', 'Runs')}
            </h2>
            <RunsList team={team} routine={routine} onOpenTask={onOpenTask} />
            <p className="text-xs text-muted-foreground">
              {translate(
                'components.botTeams.routineRunsHelp',
                'Each run creates one task in {{team}}’s board. Open the task to see its thread.',
                { team: team.name }
              )}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
