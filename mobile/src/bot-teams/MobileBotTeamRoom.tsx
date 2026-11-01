import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { mobileStructuredSessionStatusFeed } from '../session/mobile-structured-session-status-feed'
import type { RpcClient } from '../transport/rpc-client'
import { botTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { listMobileBotTeamRoom, postMobileBotTeamRequest, startMobileBotTeamTask } from './mobile-bot-team-room-rpc'

function TaskRow({
  client,
  task,
  team,
  onStart,
  onOpen
}: {
  client: RpcClient
  task: BotTeamTask
  team: BotTeam
  onStart: () => void
  onOpen: () => void
}) {
  const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
  const feed = mobileStructuredSessionStatusFeed(client)
  const subscribe = useCallback((listener: () => void) => feed.subscribe(listener), [feed])
  const readSummary = () => (task.sessionId ? feed.getSnapshot().get(task.sessionId) : undefined)
  const summary = useSyncExternalStore(subscribe, readSummary, readSummary)
  return (
    <View style={styles.row}>
      {owner ? <MobileAgentIcon agentId={owner.agent} size={20} /> : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={styles.rowMeta}>
          {owner?.name} · {botTeamTaskStatus(task.sessionId, summary)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={task.sessionId === null ? `Start ${task.title}` : `Open ${task.title}`}
        onPress={task.sessionId === null ? onStart : onOpen}
        style={styles.iconButton}
      >
        <Text style={styles.rowTitle}>{task.sessionId === null ? 'Start' : 'Open'}</Text>
      </Pressable>
    </View>
  )
}

/** A team's Conference room: the channel, the composer and the team's tasks. */
export function MobileBotTeamRoom({
  client,
  team,
  onOpenTask
}: {
  client: RpcClient
  team: BotTeam
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const [messages, setMessages] = useState<BotTeamMessage[]>([])
  const [tasks, setTasks] = useState<BotTeamTask[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [needsLead, setNeedsLead] = useState(false)

  const reload = useCallback(async () => {
    const room = await listMobileBotTeamRoom(client, team.id)
    if (room) {
      setMessages(room.messages)
      setTasks(room.tasks)
      setWorkspaceId(room.workspaceId)
    }
  }, [client, team.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const send = async (start: boolean) => {
    const sent = await postMobileBotTeamRequest(client, { teamId: team.id, text: text.trim(), start })
    if (!sent.ok) {
      Alert.alert('That did not send', 'Check the connection to this host and try again.')
      return
    }
    setText('')
    setNeedsLead(sent.task === null)
    if (sent.startError) {
      Alert.alert('The bot did not start', sent.startError)
    }
    await reload()
  }

  const start = async (taskId: string) => {
    const error = await startMobileBotTeamTask(client, taskId)
    if (error) {
      Alert.alert('The bot did not start', error)
    }
    await reload()
  }

  const empty = text.trim() === ''
  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      {messages.map((message) => (
        <View key={message.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowMeta}>
              {team.bots.find((bot) => bot.id === message.authorBotId)?.name ?? 'You'}
            </Text>
            <Text style={styles.rowTitle}>{message.text}</Text>
          </View>
        </View>
      ))}
      {needsLead ? (
        <Text style={styles.rowMeta}>Who should take this? Mention a bot with @ and its name.</Text>
      ) : null}
      <TextInput
        style={[styles.input, styles.inputTall]}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Message the team"
        accessibilityLabel="Message the team"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: empty }}
        disabled={empty}
        onPress={() => void send(true)}
        style={[styles.primary, empty && styles.primaryDisabled]}
      >
        <Text style={styles.primaryText}>Send</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: empty }}
        disabled={empty}
        onPress={() => void send(false)}
        style={styles.row}
      >
        <Text style={styles.rowTitle}>Save to Todo</Text>
      </Pressable>
      <Text style={styles.label}>Tasks</Text>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          client={client}
          task={task}
          team={team}
          onStart={() => void start(task.id)}
          onOpen={() => {
            if (workspaceId) {
              onOpenTask(workspaceId, task)
            }
          }}
        />
      ))}
    </ScrollView>
  )
}
