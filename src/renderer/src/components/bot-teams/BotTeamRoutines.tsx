import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import {
  listBotTeamRoutines,
  setBotTeamRoutinePaused
} from '@/runtime/runtime-bot-team-client-routines'
import { useAppStore } from '@/store'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamRoutine } from '../../../../shared/rpc-contract/bot-team-routine-params'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamFilesBar } from './BotTeamFilesBar'
import {
  routineAccessLabel,
  routineRunStatus,
  routineRunsLine,
  routineScheduleLine
} from './BotTeamRoutineLabels'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'
import { useTeamWork } from './use-bot-team-work'

/** The team's routines on its host; 'unavailable' is a host from before routines. */
export function useBotTeamRoutines(teamId: string): {
  routines: BotTeamRoutine[] | 'unavailable' | null
  replace: (routine: BotTeamRoutine) => void
} {
  const [routines, setRoutines] = useState<BotTeamRoutine[] | 'unavailable' | null>(null)
  useEffect(() => {
    let closed = false
    void listBotTeamRoutines(teamId).then(
      (listed) => !closed && setRoutines(listed),
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [teamId])
  const replace = useCallback(
    (routine: BotTeamRoutine) =>
      setRoutines((current) =>
        Array.isArray(current)
          ? current.map((entry) => (entry.id === routine.id ? routine : entry))
          : current
      ),
    []
  )
  return { routines, replace }
}

/** On and Paused, side by side; pausing keeps the routine's history. */
export function BotTeamRoutineSwitch({
  routine,
  onChanged
}: {
  routine: BotTeamRoutine
  onChanged: (routine: BotTeamRoutine) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={routine.paused ? 'paused' : 'on'}
      onValueChange={(next) => {
        if (next !== 'on' && next !== 'paused') {
          return
        }
        void setBotTeamRoutinePaused(routine.id, next === 'paused').then(
          onChanged,
          (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
        )
      }}
    >
      <ToggleGroupItem value="on">
        {translate('components.botTeams.routineOn', 'On')}
      </ToggleGroupItem>
      <ToggleGroupItem value="paused">
        {translate('components.botTeams.routinePaused', 'Paused')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

/** The host the team runs on, as the person named it. */
export function useBotTeamHostName(): string {
  const host = useBotTeamHost()
  const environments = useAppStore((state) => state.runtimeEnvironments)
  return (
    environments.find((environment) => environment.id === host)?.name ??
    translate('components.botTeams.thisComputer', 'This computer')
  )
}

/** Routines (boards 39 and 40): what each does and when, with the way to add one. */
export function BotTeamRoutines({
  team,
  onNew,
  onOpen,
  webAddresses
}: {
  team: BotTeam
  onNew: () => void
  onOpen: (routineId: string) => void
  /** The Web addresses section under the routines. */
  webAddresses?: React.ReactNode
}): React.JSX.Element {
  const { routines, replace } = useBotTeamRoutines(team.id)
  const { tasks } = useTeamWork(team.id)
  const statuses = useBotTeamSessionStatuses()
  const hostName = useBotTeamHostName()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamFilesBar>
        <span className="min-w-0 flex-1 truncate">
          {translate('components.botTeams.routines', 'Routines')}
        </span>
        <span className="truncate text-xs text-muted-foreground">{team.name}</span>
        {Array.isArray(routines) ? (
          <Button variant="outline" size="sm" onClick={onNew}>
            <Plus className="size-3.5" />
            {translate('components.botTeams.newRoutine', 'New routine')}
          </Button>
        ) : null}
      </BotTeamFilesBar>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <p className="text-sm text-muted-foreground">
            {translate(
              'components.botTeams.routinesIntro',
              'A routine starts a task on a schedule. Each run is kept in its history.'
            )}
          </p>
          <h2 className="text-lg font-semibold">
            {translate('components.botTeams.routines', 'Routines')}
          </h2>
          {routines === 'unavailable' ? (
            <p className="text-sm text-muted-foreground">
              {translate(
                'components.botTeams.routinesUnavailable',
                'This host cannot run routines yet.'
              )}
            </p>
          ) : routines === null ? null : routines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-8 text-center">
              <h3 className="text-base font-semibold">
                {translate('components.botTeams.noRoutines', 'No routines yet')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {translate(
                  'components.botTeams.noRoutinesHelp',
                  'A routine starts a task on a schedule, with one bot in {{team}}. Each run is kept in its history.',
                  { team: team.name }
                )}
              </p>
              <Button size="sm" onClick={onNew}>
                {translate('components.botTeams.newRoutine', 'New routine')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col rounded-xl border border-border bg-card">
              {routines.map((routine) => {
                const bot = team.bots.find((entry) => entry.id === routine.botId)
                const lastStatus = routine.lastRun
                  ? (routineRunStatus(routine.lastRun, tasks, statuses)?.label ?? null)
                  : null
                return (
                  <div
                    key={routine.id}
                    className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => onOpen(routine.id)}
                    >
                      <BotAgentIcon agent={bot?.agent} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{routine.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {`${routineScheduleLine(routine.schedule)}, ${bot?.name ?? ''}, ${routineAccessLabel(team).toLowerCase()}`}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {routineRunsLine(routine, lastStatus)}
                        </span>
                      </span>
                    </button>
                    <BotTeamRoutineSwitch routine={routine} onChanged={replace} />
                  </div>
                )
              })}
            </div>
          )}
          {webAddresses}
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.routinesHost',
              'Runs on {{host}}, the host {{team}} uses.',
              { host: hostName, team: team.name }
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
