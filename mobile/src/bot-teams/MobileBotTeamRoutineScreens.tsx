import { lazy, Suspense } from 'react'
import { Pressable, Text } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamRoutineNew } from './MobileBotTeamRoutineNew'
import { MobileBotTeamRoutineRuns } from './MobileBotTeamRoutineRuns'
import { MobileBotTeamRoutines } from './MobileBotTeamRoutines'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

// Loaded when a web address opens: it reaches for the clipboard, which other screens never need.
const MobileBotTeamWebhook = lazy(() =>
  import('./MobileBotTeamWebhook').then((module) => ({ default: module.MobileBotTeamWebhook }))
)

/** The screens under a team's Routines: the list, a new routine, one routine's runs, a web address. */
export type BotTeamRoutineScreen = (
  | { name: 'routines'; teamId: string }
  | { name: 'routineNew'; teamId: string }
  | { name: 'routineRuns'; teamId: string; routineId: string }
  | { name: 'webhook'; teamId: string; webhookId?: string }
) & {
  /** 'room' when opened from the room menu: the list then goes back to the room, not the bots. */
  origin?: 'room'
}

const ROUTINE_SCREEN_NAMES: readonly string[] = ['routines', 'routineNew', 'routineRuns', 'webhook']

/** True for the screens Routines opens, so the screen file can hand them to this module. */
export function isBotTeamRoutineScreen(screen: { name: string }): screen is BotTeamRoutineScreen {
  return ROUTINE_SCREEN_NAMES.includes(screen.name)
}

/** Where Routines opens from: a row at the end of a team's bots. */
export function MobileBotTeamRoutinesRow({
  team,
  onOpen
}: {
  team: BotTeam
  onOpen: (screen: BotTeamRoutineScreen) => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${team.name} routines`}
      onPress={() => onOpen({ name: 'routines', teamId: team.id })}
      style={styles.row}
    >
      <Text style={styles.rowTitle}>Routines</Text>
    </Pressable>
  )
}

/** Every screen a team's Routines can lead to, or back out to. */
export type BotTeamRoutineExit =
  | BotTeamRoutineScreen
  | { name: 'team'; teamId: string }
  | { name: 'teamBots'; teamId: string }
  | { name: 'settings' }

export function MobileBotTeamRoutineScreens({
  client,
  teams,
  offline,
  screen,
  onScreen,
  onOpenTask
}: {
  client: RpcClient
  teams: readonly BotTeam[]
  offline: boolean
  screen: BotTeamRoutineScreen
  onScreen: (screen: BotTeamRoutineExit) => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const team = teams.find((entry) => entry.id === screen.teamId)
  if (!team) {
    return null
  }
  const origin = screen.origin ? { origin: screen.origin } : {}
  const toRoutines = () => onScreen({ name: 'routines', teamId: team.id, ...origin })
  const leaveRoutines: BotTeamRoutineExit =
    screen.origin === 'room'
      ? { name: 'team', teamId: team.id }
      : { name: 'teamBots', teamId: team.id }
  if (screen.name === 'routineNew') {
    return (
      <MobileBotTeamRoutineNew
        client={client}
        team={team}
        offline={offline}
        onBack={toRoutines}
        onCreated={toRoutines}
        onChangeAccess={() => onScreen({ name: 'settings' })}
      />
    )
  }
  if (screen.name === 'routineRuns') {
    return (
      <MobileBotTeamRoutineRuns
        client={client}
        team={team}
        routineId={screen.routineId}
        offline={offline}
        onBack={toRoutines}
        onOpenTask={onOpenTask}
      />
    )
  }
  if (screen.name === 'webhook') {
    return (
      <Suspense fallback={null}>
        <MobileBotTeamWebhook
          client={client}
          team={team}
          offline={offline}
          {...(screen.webhookId ? { webhookId: screen.webhookId } : {})}
          onBack={toRoutines}
        />
      </Suspense>
    )
  }
  return (
    <MobileBotTeamRoutines
      client={client}
      team={team}
      offline={offline}
      onBack={() => onScreen(leaveRoutines)}
      onOpenRoutine={(routineId) =>
        onScreen({ name: 'routineRuns', teamId: team.id, routineId, ...origin })
      }
      onNewRoutine={() => onScreen({ name: 'routineNew', teamId: team.id, ...origin })}
      onOpenWebhook={(webhookId) =>
        onScreen({
          name: 'webhook',
          teamId: team.id,
          ...(webhookId ? { webhookId } : {}),
          ...origin
        })
      }
    />
  )
}
