import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamRoutineNew } from './MobileBotTeamRoutineNew'
import { useMobileBotTeamRoutines } from './MobileBotTeamRoutines'

/** Edit routine: the routine form, filled in once the team's routines are read. */
export function MobileBotTeamRoutineEdit({
  client,
  team,
  routineId,
  offline,
  onDone,
  onChangeAccess
}: {
  client: RpcClient
  team: BotTeam
  routineId: string
  offline: boolean
  onDone: () => void
  onChangeAccess: () => void
}) {
  const { read } = useMobileBotTeamRoutines(client, team.id, offline)
  const routine = read?.kind === 'ready' ? read.value.find((entry) => entry.id === routineId) : null
  return routine ? (
    <MobileBotTeamRoutineNew
      key={routine.id}
      client={client}
      team={team}
      routine={routine}
      offline={offline}
      onBack={onDone}
      onCreated={onDone}
      onChangeAccess={onChangeAccess}
    />
  ) : null
}
