import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { Bot, Check, ChevronDown, ChevronLeft, Ellipsis, MessageSquare } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { useMobileDictation } from '../hooks/use-mobile-dictation'
import { MobileNativeChatComposer } from '../session/MobileNativeChatComposer'
import { MobileNativeChatMessage } from '../session/MobileNativeChatMessage'
import { mobileStructuredSessionStatusFeed } from '../session/mobile-structured-session-status-feed'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { botTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import {
  listMobileBotTeamRoom,
  postMobileBotTeamRequest,
  startMobileBotTeamTask
} from './mobile-bot-team-room-rpc'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'

const NO_GENERATION = () => 0
const NOT_WORKING = () => false

function statusDotColor(status: string): string {
  if (status === 'Working' || status === 'Done') {
    return colors.statusGreen
  }
  return status === 'Waiting for you' ? colors.statusAmber : colors.textMuted
}

function TaskCard({
  client,
  task,
  team,
  offline,
  onStart,
  onOpen
}: {
  client: RpcClient
  task: BotTeamTask
  team: BotTeam
  offline: boolean
  onStart: () => void
  onOpen: () => void
}) {
  const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
  const feed = mobileStructuredSessionStatusFeed(client)
  const subscribe = useCallback((listener: () => void) => feed.subscribe(listener), [feed])
  const readSummary = () => (task.sessionId ? feed.getSnapshot().get(task.sessionId) : undefined)
  const summary = useSyncExternalStore(subscribe, readSummary, readSummary)
  const status = botTeamTaskStatus(task.sessionId, summary)
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
        <View style={styles.taskCardStatus}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor(status) }]} />
          <Text style={styles.rowMeta}>
            {status}
            {offline && task.sessionId !== null ? ', can’t confirm now' : ''}
          </Text>
        </View>
      </Pressable>
      {task.sessionId === null ? (
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

function roomChatMessage(message: BotTeamMessage): NativeChatMessage {
  return {
    id: message.id,
    role: message.authorBotId === null ? 'user' : 'assistant',
    blocks: [{ type: 'text', text: message.text }],
    timestamp: null,
    source: 'transcript'
  }
}

/** A team's Conference room, drawn from the session chat's own composer and message row. */
export function MobileBotTeamRoom({
  client,
  team,
  teams,
  offline = false,
  workingOf = NOT_WORKING,
  onBack,
  onPickTeam,
  onOpenBots,
  onOpenTask
}: {
  client: RpcClient
  team: BotTeam
  teams: readonly BotTeam[]
  /** The host stopped answering: nothing can be sent, and what is shown may be out of date. */
  offline?: boolean
  /** The team's real state, so its character shows when its bots are working. */
  workingOf?: (teamId: string) => boolean
  onBack: () => void
  onPickTeam: (teamId: string) => void
  onOpenBots: () => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const [messages, setMessages] = useState<BotTeamMessage[]>([])
  const [tasks, setTasks] = useState<BotTeamTask[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [needsLead, setNeedsLead] = useState(false)
  const [sheet, setSheet] = useState<'rooms' | 'menu' | null>(null)
  const dictation = useMobileDictation({
    client,
    enabled: !offline,
    onTranscript: (transcript) =>
      setText((current) => (current ? `${current} ${transcript}` : transcript)),
    onError: (error) => Alert.alert('Dictation failed', error.message)
  })

  const reload = useCallback(async () => {
    const room = await listMobileBotTeamRoom(client, team.id)
    if (room) {
      setMessages(room.messages)
      setTasks(room.tasks)
      setWorkspaceId(room.workspaceId)
    }
  }, [client, team.id])

  useEffect(() => {
    if (!offline) {
      void reload()
    }
  }, [reload, offline])

  const send = async (typed: string): Promise<boolean> => {
    const sent = await postMobileBotTeamRequest(client, {
      teamId: team.id,
      text: typed,
      start: true
    })
    if (!sent.ok) {
      Alert.alert('That did not send', 'Check the connection to this host and try again.')
      return false
    }
    setText('')
    setNeedsLead(sent.task === null)
    if (sent.startError) {
      Alert.alert('The bot did not start', sent.startError)
    }
    await reload()
    return true
  }

  const start = async (taskId: string) => {
    const error = await startMobileBotTeamTask(client, taskId)
    if (error) {
      Alert.alert('The bot did not start', error)
    }
    await reload()
  }

  // A task sits under the request that made it; the rest follow the conversation.
  const tasksOf = useMemo(() => {
    const placed = new Map<string, BotTeamTask[]>()
    const rest: BotTeamTask[] = []
    for (const task of tasks) {
      const request = messages.find((m) => m.authorBotId === null && m.text === task.prompt)
      if (request) {
        placed.set(request.id, [...(placed.get(request.id) ?? []), task])
      } else {
        rest.push(task)
      }
    }
    return { placed, rest }
  }, [messages, tasks])

  const card = (task: BotTeamTask) => (
    <TaskCard
      key={task.id}
      client={client}
      task={task}
      team={team}
      offline={offline}
      onStart={() => void start(task.id)}
      onOpen={() => {
        if (workspaceId) {
          onOpenTask(workspaceId, task)
        }
      }}
    />
  )

  return (
    <View style={styles.grow}>
      <View style={styles.floatBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.roundButton}
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch Conference room"
          onPress={() => setSheet('rooms')}
          style={styles.roomPill}
        >
          <MobileBotTeamCharacterIcon
            character={team.character}
            size={20}
            working={workingOf(team.id)}
            unreachable={offline}
          />
          <Text style={styles.roomPillText} numberOfLines={1}>
            {team.name}
          </Text>
          <ChevronDown size={14} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Room menu"
          onPress={() => setSheet('menu')}
          style={styles.roundButton}
        >
          <Ellipsis size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.grow}
        contentContainerStyle={styles.roomFeed}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && tasks.length === 0 ? (
          <Text style={styles.message}>
            Ask {team.name} for something. Each request becomes one or more tasks.
          </Text>
        ) : null}
        {messages.map((message) => {
          const author = team.bots.find((bot) => bot.id === message.authorBotId)
          return (
            <View key={message.id} style={styles.roomEntry}>
              {author ? (
                <View style={styles.roomWho}>
                  <MobileBotAgentIcon agentId={author.agent} size={14} />
                  <Text style={styles.roomWhoText}>{author.name}</Text>
                </View>
              ) : null}
              <MobileNativeChatMessage message={roomChatMessage(message)} />
              {tasksOf.placed.get(message.id)?.map(card)}
            </View>
          )
        })}
        {tasksOf.rest.map(card)}
        {needsLead ? (
          <Text style={styles.rowMeta}>
            Who should take this? Mention a bot with @ and its name.
          </Text>
        ) : null}
      </ScrollView>
      <MobileNativeChatComposer
        value={text}
        onChangeText={setText}
        onSend={send}
        sendSurfaceId={team.id}
        getSendCompletionGeneration={NO_GENERATION}
        getComposerEditGeneration={NO_GENERATION}
        disabled={offline}
        placeholder="Message the team"
        onMicPress={() => void (dictation.isRecording ? dictation.stop() : dictation.start())}
        micActive={dictation.isRecording}
      />
      <BottomDrawer visible={sheet === 'rooms'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>Conference rooms</Text>
        {teams.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            onPress={() => {
              setSheet(null)
              onPickTeam(entry.id)
            }}
            style={styles.row}
          >
            <MobileBotTeamCharacterIcon
              character={entry.character}
              size={28}
              working={workingOf(entry.id)}
              unreachable={offline}
            />
            <Text style={[styles.rowTitle, styles.grow]}>{entry.name}</Text>
            {entry.id === team.id ? <Check size={18} color={colors.textPrimary} /> : null}
          </Pressable>
        ))}
      </BottomDrawer>
      <BottomDrawer visible={sheet === 'menu'} onClose={() => setSheet(null)}>
        <View style={styles.sheetHeader}>
          <MobileBotTeamCharacterIcon
            character={team.character}
            size={28}
            working={workingOf(team.id)}
            unreachable={offline}
          />
          <Text style={styles.sheetTitle}>{team.name}</Text>
        </View>
        <Text style={styles.label}>Work</Text>
        <Pressable accessibilityRole="button" onPress={() => setSheet(null)} style={styles.row}>
          <MessageSquare size={18} color={colors.textSecondary} />
          <Text style={styles.rowTitle}>Conference room</Text>
        </Pressable>
        <Text style={styles.label}>Team</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSheet(null)
            onOpenBots()
          }}
          style={styles.row}
        >
          <Bot size={18} color={colors.textSecondary} />
          <Text style={styles.rowTitle}>Bots</Text>
        </Pressable>
      </BottomDrawer>
    </View>
  )
}
