import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  createBotTeamRoutine,
  listBotTeamRoutines,
  updateBotTeamRoutine
} from '@/runtime/runtime-bot-team-client-routines'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { routineScheduleLine } from './BotTeamRoutineLabels'

type SimilarRoutineChoice = Extract<BotTeamRequestChoice, { kind: 'similar-routine' }>

/**
 * The room's question when a one-time request is like a routine the team already runs: move that routine to
 * the moment the request names, or keep it and make the request a routine of its own.
 */
export function BotTeamSimilarRoutineChoice({
  choice,
  team,
  onDone
}: {
  choice: SimilarRoutineChoice
  team: BotTeam
  /** The answer was saved; the room reads itself again and drops the question. */
  onDone: () => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const { request, routineName } = choice
  const answer = async (save: () => Promise<void>, saved: string): Promise<void> => {
    setBusy(true)
    try {
      await save()
      toast.success(saved)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  const reschedule = (): Promise<void> =>
    answer(
      async () => {
        const routines = await listBotTeamRoutines(team.id)
        const current =
          routines === 'unavailable'
            ? undefined
            : routines.find((routine) => routine.id === choice.routineId)
        if (current === undefined) {
          throw new Error(
            translate('components.botTeams.similarRoutineGone', 'That task is no longer scheduled.')
          )
        }
        await updateBotTeamRoutine({
          routineId: current.id,
          botId: current.botId,
          name: current.name,
          prompt: current.prompt,
          schedule: request.schedule
        })
      },
      translate('components.botTeams.similarRoutineRescheduled', 'Rescheduled {{name}}', {
        name: routineName
      })
    )
  const create = (): Promise<void> =>
    answer(
      async () => {
        await createBotTeamRoutine({ teamId: team.id, ...request })
      },
      translate('components.botTeams.similarRoutineCreated', 'Scheduled {{name}}', {
        name: request.name
      })
    )
  const question = translate(
    'components.botTeams.similarRoutineQuestion',
    'You already have a similar task scheduled. Reschedule it, or create a new one?'
  )
  const current = routineScheduleLine({
    frequency: 'once',
    time: choice.routineNextRun.time,
    weekday: null,
    monthDay: null,
    date: choice.routineNextRun.date,
    timeZone: null
  })
  const next = routineScheduleLine(request.schedule)
  return (
    <div
      role="group"
      aria-label={question}
      aria-busy={busy}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <p className="text-sm font-semibold text-foreground">{question}</p>
      <div className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
        <span className="truncate">
          {translate('components.botTeams.similarRoutineCurrent', '{{name}}: {{schedule}}', {
            name: routineName,
            schedule: current
          })}
        </span>
        <span className="truncate">
          {translate('components.botTeams.similarRoutineNext', 'New time: {{schedule}}', {
            schedule: next
          })}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void create()}>
          {translate('components.botTeams.similarRoutineCreate', 'Create a new one')}
        </Button>
        <Button disabled={busy} onClick={() => void reschedule()}>
          {translate('components.botTeams.similarRoutineReschedule', 'Reschedule {{name}}', {
            name: routineName
          })}
        </Button>
      </div>
    </div>
  )
}
