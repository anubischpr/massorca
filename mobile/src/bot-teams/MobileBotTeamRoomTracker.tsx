import { Pressable, Text, View } from 'react-native'
import type { BotTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamSentRequest } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** A request this room sent to another team: that team's character, the task, its live status and a way in. */
export function MobileBotTeamRequestTracker({
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
}) {
  return (
    <View style={styles.taskCard}>
      <View style={styles.taskCardBody}>
        <View style={styles.taskCardTitle}>
          <MobileBotTeamCharacterIcon character={team.character} size={20} />
          <Text style={styles.rowTitle} numberOfLines={2}>
            {request.task.title}
          </Text>
        </View>
        <Text style={styles.rowMeta}>{team.name}</Text>
        <View style={styles.taskCardStatus}>
          {status === 'Unknown' ? (
            <View
              accessibilityLabel="Checking status"
              style={{
                width: 56,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.borderSubtle
              }}
            />
          ) : (
            <Text style={styles.rowMeta}>{status}</Text>
          )}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open in ${team.name}`}
        accessibilityState={{ disabled: offline }}
        disabled={offline}
        onPress={onOpen}
        style={styles.secondary}
      >
        <Text style={styles.rowTitle}>{`Open in ${team.name}`}</Text>
      </Pressable>
    </View>
  )
}

/** The trackers of the requests that went to other teams; a request whose team is not known is left out. */
export function MobileBotTeamSentTrackers({
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
  onOpenTeam: (teamId: string) => void
}) {
  return (
    <>
      {requests.map((request) => {
        const holder = teams.find((entry) => entry.id === request.task.teamId)
        return holder ? (
          <MobileBotTeamRequestTracker
            key={request.task.id}
            request={request}
            team={holder}
            status={statusOf(request.task)}
            offline={offline}
            onOpen={() => onOpenTeam(holder.id)}
          />
        ) : null
      })}
    </>
  )
}
