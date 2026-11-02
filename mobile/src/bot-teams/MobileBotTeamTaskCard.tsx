import { Pressable, Text, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

function statusDotColor(status: string): string {
  if (status === 'Working' || status === 'Done') {
    return colors.statusGreen
  }
  return status === 'Waiting for you' ? colors.statusAmber : colors.textMuted
}

/** A task's owner, project and status; it opens in its workspace, and only the room starts it. */
export function MobileBotTeamTaskCard({
  client,
  task,
  team,
  offline,
  projectName = null,
  onStart,
  onOpen
}: {
  client: RpcClient
  task: BotTeamTask
  team: BotTeam
  offline: boolean
  /** Shown on a board that spans projects; the room leaves it out. */
  projectName?: string | null
  onStart?: () => void
  onOpen: () => void
}) {
  const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const status = statusOf(task)
  return (
    <View style={[styles.taskCard, status === 'Waiting for you' && styles.taskCardWaiting]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${task.title}`}
        accessibilityState={{ disabled: offline || task.sessionId === null }}
        disabled={offline || task.sessionId === null}
        onPress={onOpen}
        style={styles.taskCardBody}
      >
        <View style={styles.taskCardTitle}>
          {owner ? <MobileBotAgentIcon agentId={owner.agent} size={14} /> : null}
          <Text style={styles.rowTitle} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        {owner ? (
          <Text style={styles.rowMeta}>
            {owner.name}
            {owner.job ? `, ${owner.job}` : ''}
          </Text>
        ) : null}
        {projectName ? <Text style={styles.rowMeta}>{projectName}</Text> : null}
        <View style={styles.taskCardStatus}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor(status) }]} />
          <Text style={styles.rowMeta}>
            {status}
            {offline && task.sessionId !== null ? ', can’t confirm now' : ''}
          </Text>
        </View>
      </Pressable>
      {task.sessionId === null && onStart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${task.title}`}
          accessibilityState={{ disabled: offline }}
          disabled={offline}
          onPress={onStart}
          style={styles.secondary}
        >
          <Text style={styles.rowTitle}>Start</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
