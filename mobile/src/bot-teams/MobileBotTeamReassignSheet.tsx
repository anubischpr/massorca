import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { reassignMobileBotTeamTask } from './mobile-bot-team-request-rpc'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** Who should own an idle task: any bot of any team, and the new owner continues from the task so far. */
export function MobileBotTeamReassignSheet({
  client,
  task,
  teams,
  visible,
  onClose,
  onDone
}: {
  client: RpcClient
  task: BotTeamTask
  teams: readonly BotTeam[]
  visible: boolean
  onClose: () => void
  /** The task was handed over; the screen reads the room again. */
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const pick = async (botId: string) => {
    setBusy(true)
    const filed = await reassignMobileBotTeamTask(client, { taskId: task.id, botId })
    setBusy(false)
    if (filed.kind === 'unsupported') {
      Alert.alert('That did not save', 'This host cannot move tasks yet.')
      return
    }
    if (filed.kind === 'failed') {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
      return
    }
    if (filed.startError) {
      Alert.alert('The bot did not start', filed.startError)
    }
    onClose()
    onDone()
  }

  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>{`Who should own ${task.title}?`}</Text>
      <Text style={styles.rowMeta}>
        The new owner reads the task so far and continues from there.
      </Text>
      {teams.flatMap((team) =>
        team.bots
          .filter((bot) => bot.id !== task.ownerBotId)
          .map((bot) => (
            <Pressable
              key={bot.id}
              accessibilityRole="button"
              accessibilityLabel={`Give to ${bot.name}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void pick(bot.id)}
              style={styles.row}
            >
              <MobileBotAgentIcon agentId={bot.agent} size={20} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{bot.name}</Text>
                <Text style={styles.rowMeta}>
                  {bot.job ? `${team.name}, ${bot.job}` : team.name}
                </Text>
              </View>
            </Pressable>
          ))
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onClose}
        style={styles.secondary}
      >
        <Text style={styles.rowTitle}>Cancel</Text>
      </Pressable>
    </BottomDrawer>
  )
}
