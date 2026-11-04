import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import {
  listBotTeamRoutines,
  setBotTeamRoutinePaused
} from '@/runtime/runtime-bot-team-client-routines'
import { useAppStore } from '@/store'
import { isArchivedBotTeamRoutine } from '../../../../shared/bot-team-routine-archive'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamRoutine } from '../../../../shared/rpc-contract/bot-team-routine-params'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamFilesBar } from './BotTeamFilesBar'
import { BotTeamRoutineMenu } from './BotTeamRoutineActions'
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
  drop: (routineId: string) => void
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
  const drop = useCallback(
    (routineId: string) =>
      setRoutines((current) =>
        Array.isArray(current) ? current.filter((entry) => entry.id !== routineId) : current
      ),
    []
  )
  return { routines, replace, drop }
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

/** One routine: what it does and when; an archived one keeps only its menu (board 57). */
function RoutineRow({
  routine,
  archived = false,
  team,
  tasks,
  statuses,
  onOpen,
  onEdit,
  onChanged,
  onDeleted
}: {
  routine: BotTeamRoutine
  archived?: boolean
  team: BotTeam
  tasks: Parameters<typeof routineRunStatus>[1]
  statuses: Parameters<typeof routineRunStatus>[2]
  onOpen: (routineId: string) => void
  onEdit: (routineId: string) => void
  onChanged: (routine: BotTeamRoutine) => void
  onDeleted: (routineId: string) => void
}): React.JSX.Element {
  const bot = team.bots.find((entry) => entry.id === routine.botId)
  const lastStatus = routine.lastRun
    ? (routineRunStatus(routine.lastRun, tasks, statuses)?.label ?? null)
    : null
  const detail = archived
    ? `${routineScheduleLine(routine.schedule)}, ${bot?.name ?? ''}`
    : `${routineScheduleLine(routine.schedule)}, ${bot?.name ?? ''}, ${routineAccessLabel(team).toLowerCase()}`
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => onOpen(routine.id)}
      >
        <span className="shrink-0 data-[archived=true]:opacity-60" data-archived={archived}>
          <BotAgentIcon agent={bot?.agent} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{routine.name}</span>
          <span className="block text-xs text-muted-foreground">{detail}</span>
          <span className="block text-xs text-muted-foreground">
            {routineRunsLine(routine, lastStatus)}
          </span>
        </span>
      </button>
      {archived ? null : <BotTeamRoutineSwitch routine={routine} onChanged={onChanged} />}
      <BotTeamRoutineMenu routine={routine} onEdit={onEdit} onDeleted={onDeleted} />
    </div>
  )
}

/** Routines (boards 39, 40 and 57): what each does and when, the way to add one, and the finished ones archived. */
export function BotTeamRoutines({
  team,
  onNew,
  onOpen,
  onEdit,
  webAddresses
}: {
  team: BotTeam
  onNew: () => void
  onOpen: (routineId: string) => void
  onEdit: (routineId: string) => void
  /** The Web addresses section under the routines. */
  webAddresses?: React.ReactNode
}): React.JSX.Element {
  const { routines, replace, drop } = useBotTeamRoutines(team.id)
  const { tasks } = useTeamWork(team.id)
  const statuses = useBotTeamSessionStatuses()
  const hostName = useBotTeamHostName()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const listed = Array.isArray(routines) ? routines : []
  const active = listed.filter((routine) => !isArchivedBotTeamRoutine(routine))
  const archived = listed.filter(isArchivedBotTeamRoutine)
  const rowProps = { team, tasks, statuses, onOpen, onEdit, onChanged: replace, onDeleted: drop }
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
            <>
              {active.length > 0 ? (
                <div className="flex flex-col rounded-xl border border-border bg-card">
                  {active.map((routine) => (
                    <RoutineRow key={routine.id} routine={routine} {...rowProps} />
                  ))}
                </div>
              ) : null}
              {archived.length > 0 ? (
                <Collapsible open={archiveOpen} onOpenChange={setArchiveOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 py-1 text-sm font-semibold">
                    {archiveOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    {translate('components.botTeams.routinesArchived', 'Archived')}
                    <span className="font-normal text-muted-foreground">{archived.length}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-col rounded-xl border border-border bg-card">
                      {archived.map((routine) => (
                        <RoutineRow key={routine.id} routine={routine} archived {...rowProps} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </>
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
