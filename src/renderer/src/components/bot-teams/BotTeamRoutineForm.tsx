import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamRoutineNew } from './BotTeamRoutineNew'
import { useBotTeamRoutines } from './BotTeamRoutines'

/** New routine, or Edit routine once the team's routines have loaded. */
export function BotTeamRoutineForm({
  team,
  routineId,
  onDone
}: {
  team: BotTeam
  routineId?: string
  onDone: () => void
}): React.JSX.Element | null {
  const { routines } = useBotTeamRoutines(team.id)
  if (!routineId) {
    return <BotTeamRoutineNew team={team} onBack={onDone} onCreated={onDone} />
  }
  const routine = Array.isArray(routines)
    ? routines.find((entry) => entry.id === routineId)
    : undefined
  return routine ? (
    <BotTeamRoutineNew
      key={routine.id}
      team={team}
      routine={routine}
      onBack={onDone}
      onCreated={onDone}
    />
  ) : null
}
